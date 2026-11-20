// Hive Break · Validador do catálogo estendido (Etapa 1B do
// docs/PLANO_ETAPAS_UX.md). Só lê arquivos (nenhuma tela, nenhum banco).
// Rode com: npm run validar-catalogo
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Contexto, ExercicioCatalogo, Licao, Objeto } from "../src/dominio/catalogo";

const raiz = path.resolve(__dirname, "..");

/** O exercício como o arquivo JSON de fato é (motor + catalogo + campos legados). */
export interface ExercicioBruto {
  id: string;
  variacao_facil?: string;
  alternativas?: Record<string, string>;
  catalogo?: unknown;
}

export interface ResultadoValidacao {
  erros: string[];
  avisos: string[];
}

export interface EntradaValidacao {
  exercicios: ExercicioBruto[];
  objetos: unknown[];
  contextos: unknown[];
  licoes: unknown[];
}

const issuesDoZod = (issues: { path: PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");

/**
 * Valida o catálogo (exercícios, objetos, contextos e lições). Função pura,
 * sem tocar no disco — os testes passam os dados já carregados.
 */
export function validarCatalogo({ exercicios, objetos, contextos, licoes }: EntradaValidacao): ResultadoValidacao {
  const erros: string[] = [];
  const avisos: string[] = [];
  const idsExercicios = new Set(exercicios.map((e) => e.id));

  // --------------------------------------------------------------- exercícios
  const catalogos = new Map<string, ExercicioCatalogo>();
  for (const e of exercicios) {
    const r = ExercicioCatalogo.safeParse(e.catalogo);
    if (!r.success) {
      erros.push(`exercício "${e.id}": catálogo inválido — ${issuesDoZod(r.error.issues)}`);
      continue;
    }
    catalogos.set(e.id, r.data);
  }

  for (const [id, cat] of catalogos) {
    if (cat.equipamento !== "E0" && !cat.substitutoE0Id) {
      erros.push(`exercício "${id}": equipamento ${cat.equipamento} sem substitutoE0Id`);
    }
    if (cat.substitutoE0Id && !idsExercicios.has(cat.substitutoE0Id)) {
      erros.push(`exercício "${id}": substitutoE0Id "${cat.substitutoE0Id}" não existe`);
    }
    if (!cat.flags.semSalto && !cat.versaoSemImpactoId) {
      erros.push(`exercício "${id}": tem salto (flags.semSalto = false) sem versaoSemImpactoId`);
    }
    if (cat.versaoSemImpactoId && !idsExercicios.has(cat.versaoSemImpactoId)) {
      erros.push(`exercício "${id}": versaoSemImpactoId "${cat.versaoSemImpactoId}" não existe`);
    }
    if (cat.variacaoDe && !idsExercicios.has(cat.variacaoDe)) {
      erros.push(`exercício "${id}": variacaoDe "${cat.variacaoDe}" não existe`);
    }
  }

  // Campos legados (motor): variacao_facil e alternativas, fora da chave catalogo.
  for (const e of exercicios) {
    if (e.variacao_facil && !idsExercicios.has(e.variacao_facil)) {
      erros.push(`exercício "${e.id}": variacao_facil "${e.variacao_facil}" não existe`);
    }
    for (const [lado, destino] of Object.entries(e.alternativas ?? {})) {
      if (!idsExercicios.has(destino)) erros.push(`exercício "${e.id}": alternativas.${lado} "${destino}" não existe`);
    }
  }

  // ------------------------------------------------------------------ objetos
  const idsObjetos = new Set<string>();
  objetos.forEach((o, i) => {
    const r = Objeto.safeParse(o);
    if (!r.success) {
      erros.push(`objetos[${i}]: inválido — ${issuesDoZod(r.error.issues)}`);
      return;
    }
    idsObjetos.add(r.data.id);
  });
  for (const [id, cat] of catalogos) {
    for (const objId of cat.objetos) {
      if (!idsObjetos.has(objId)) erros.push(`exercício "${id}": objeto "${objId}" não existe em content/objetos.json`);
    }
  }

  // ---------------------------------------------------------------- contextos
  const contextosPorId = new Map<string, Contexto>();
  contextos.forEach((c, i) => {
    const r = Contexto.safeParse(c);
    if (!r.success) {
      erros.push(`contextos[${i}]: inválido — ${issuesDoZod(r.error.issues)}`);
      return;
    }
    contextosPorId.set(r.data.id, r.data);
  });

  // -------------------------------------------------------------------lições
  const licoesValidas: Licao[] = [];
  licoes.forEach((l, i) => {
    const r = Licao.safeParse(l);
    if (!r.success) {
      const id = typeof l === "object" && l && "id" in l ? String((l as { id: unknown }).id) : `licoes[${i}]`;
      erros.push(`lição "${id}": inválida — ${issuesDoZod(r.error.issues)}`);
      return;
    }
    licoesValidas.push(r.data);
  });
  const idsLicoes = new Set(licoesValidas.map((l) => l.id));

  for (const l of licoesValidas) {
    for (const b of l.blocos) {
      if (!idsExercicios.has(b.exercicioId)) erros.push(`lição "${l.id}": bloco com exercicioId "${b.exercicioId}" inexistente`);
    }
    for (const [nome, destino] of Object.entries(l.variantes)) {
      if (destino && !idsLicoes.has(destino)) erros.push(`lição "${l.id}": variantes.${nome} "${destino}" não existe`);
    }

    // Exercício incompatível com um contexto declarado.
    for (const idContexto of l.contextos) {
      const ctx = contextosPorId.get(idContexto);
      if (!ctx) {
        erros.push(`lição "${l.id}": contexto "${idContexto}" não existe em content/contextos.json`);
        continue;
      }
      for (const b of l.blocos) {
        const cat = catalogos.get(b.exercicioId);
        if (!cat) continue;
        const motivos: string[] = [];
        if (ctx.regras.semChao && !cat.flags.semChao) motivos.push("precisa do chão");
        if (ctx.regras.semSalto && !cat.flags.semSalto) motivos.push("tem salto");
        if (ctx.regras.semSuor && !cat.flags.semSuor) motivos.push("faz suar");
        if (ctx.regras.silencioso && !cat.flags.silencioso) motivos.push("faz ruído");
        if (motivos.length > 0) {
          erros.push(`lição "${l.id}": "${b.exercicioId}" incompatível com o contexto "${idContexto}" (${motivos.join(", ")})`);
        }
      }
    }

    // Duração calculada × exibida (mais de 10 s de diferença).
    const duracaoBlocos = l.blocos.reduce((soma, b) => soma + b.series * (b.esforcoS ?? 0) + (b.series - 1) * b.pausaS, 0);
    const duracaoCalculada = duracaoBlocos + Math.max(0, l.blocos.length - 1) * l.pausaEntreBlocosS;
    if (Math.abs(duracaoCalculada - l.duracaoExibidaS) > 10) {
      erros.push(`lição "${l.id}": duração calculada (${duracaoCalculada}s) difere da exibida (${l.duracaoExibidaS}s) em mais de 10 s`);
    }

    // Mais de 1 troca de posição de câmera.
    const todasPosicoes = l.blocos.map((b) => catalogos.get(b.exercicioId)?.posicaoCamera);
    const posicoes = todasPosicoes.filter((p) => p !== undefined);
    let trocas = 0;
    for (let i = 1; i < posicoes.length; i++) if (posicoes[i] !== posicoes[i - 1]) trocas++;
    if (trocas > 1) avisos.push(`lição "${l.id}": ${trocas} trocas de posição de câmera (mais de 1)`);
  }

  // Mais de 1 exercício novo por lição, dentro da mesma seção.
  const porSecao = new Map<string, Licao[]>();
  for (const l of licoesValidas) {
    const lista = porSecao.get(l.secaoId) ?? [];
    lista.push(l);
    porSecao.set(l.secaoId, lista);
  }
  for (const [secaoId, lista] of porSecao) {
    const vistos = new Set<string>();
    for (const l of [...lista].sort((a, b) => a.ordem - b.ordem)) {
      const idsDaLicao = l.blocos.map((b) => b.exercicioId);
      const novos = [...new Set(idsDaLicao.filter((id) => !vistos.has(id)))];
      if (novos.length > 1) {
        avisos.push(`lição "${l.id}" (seção "${secaoId}"): ${novos.length} exercícios novos na mesma lição (mais de 1)`);
      }
      idsDaLicao.forEach((id) => vistos.add(id));
    }
  }

  return { erros, avisos };
}

// --------------------------------------------------------------------- CLI

function lerJson(caminho: string): unknown {
  return JSON.parse(readFileSync(caminho, "utf8"));
}

function lerDiretorioJson(pasta: string): unknown[] {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((nome) => nome.endsWith(".json"))
    .map((nome) => lerJson(path.join(pasta, nome)));
}

export function carregarEntradaDoDisco(): EntradaValidacao {
  const pastaExercicios = path.join(raiz, "src", "exercicios");
  const exercicios = readdirSync(pastaExercicios)
    .filter((nome) => nome.endsWith(".json"))
    .map((nome) => lerJson(path.join(pastaExercicios, nome)) as ExercicioBruto);
  const objetos = lerJson(path.join(raiz, "content", "objetos.json")) as unknown[];
  const contextos = lerJson(path.join(raiz, "content", "contextos.json")) as unknown[];
  const licoes = lerDiretorioJson(path.join(raiz, "content", "licoes"));
  return { exercicios, objetos, contextos, licoes };
}

if (require.main === module) {
  const { erros, avisos } = validarCatalogo(carregarEntradaDoDisco());
  for (const aviso of avisos) console.warn(`aviso: ${aviso}`);
  for (const erro of erros) console.error(`erro: ${erro}`);
  console.log(`\n${erros.length} erro(s), ${avisos.length} aviso(s).`);
  if (erros.length > 0) process.exit(1);
}

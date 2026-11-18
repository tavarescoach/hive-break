import { analisar, distsUsadas, variaveisUsadas, visUsadas } from "./expressao";
import { validarDist, validarMedida } from "./medidas";
import { indicesDoPonto, PLURAIS } from "./pontos";
import type { DefinicaoExercicio } from "./tipos";

const SUSTENTACAO = new Set(["isometria", "equilibrio", "postura", "respiracao"]);

/**
 * Confere uma definição de exercício e devolve a lista de problemas
 * (vazia quando está tudo certo). Roda ao carregar o exercício e nos testes.
 */
export function validarDefinicao(def: DefinicaoExercicio): string[] {
  const problemas: string[] = [];
  const tentar = (rotulo: string, fn: () => void) => {
    try {
      fn();
    } catch (erro) {
      problemas.push(`${rotulo}: ${(erro as Error).message}`);
    }
  };

  if (!def.id) problemas.push("falta o id");
  if (!def.pontos_obrigatorios?.length) problemas.push("falta pontos_obrigatorios");
  for (const nome of def.pontos_obrigatorios ?? []) tentar("pontos_obrigatorios", () => indicesDoPonto(nome));

  tentar("medida_principal", () => validarMedida(def.medida_principal));
  const nomes = new Set<string>(["medida"]);
  for (const [nome, medida] of Object.entries(def.medidas ?? {})) {
    if (nome === "medida" || nome.startsWith("min_") || nome.startsWith("max_")) {
      problemas.push(`medidas.${nome}: nome reservado`);
    }
    nomes.add(nome);
    tentar(`medidas.${nome}`, () => validarMedida(medida));
  }

  const conferirCondicao = (rotulo: string, texto: string | undefined, permiteExtremos: boolean) => {
    if (!texto) {
      problemas.push(`${rotulo}: condição vazia`);
      return;
    }
    tentar(rotulo, () => {
      const no = analisar(texto);
      for (const v of variaveisUsadas(no)) {
        const base = v.replace(/^(min|max)_/, "");
        const ehExtremo = base !== v;
        if (!nomes.has(base)) throw new Error(`medida desconhecida "${v}"`);
        if (ehExtremo && !permiteExtremos) throw new Error(`"${v}" só vale em parcial_se e em erros de fim de repetição`);
      }
      for (const pontos of distsUsadas(no)) validarDist(pontos);
      for (const ponto of visUsadas(no)) {
        const base = PLURAIS[ponto] ?? ponto;
        indicesDoPonto(base);
      }
    });
  };

  if (def.formato === "repeticoes") {
    const fases = def.fases ?? [];
    if (fases.length < 2) problemas.push("repetições precisam de pelo menos 2 fases");
    const nomesFases = new Set(fases.map((f) => f.nome));
    for (const fase of fases) conferirCondicao(`fase ${fase.nome}`, fase.condicao, false);
    const seq = def.repeticao ?? [];
    if (seq.length < 3) problemas.push("repeticao precisa de pelo menos 3 passos (início, meio, início)");
    for (const passo of seq) if (!nomesFases.has(passo)) problemas.push(`repeticao cita fase inexistente "${passo}"`);
    if (seq.length && seq[0] !== seq[seq.length - 1]) problemas.push("repeticao precisa começar e terminar na mesma fase");
    if (def.parcial_se) conferirCondicao("parcial_se", def.parcial_se, true);
    if (def.amplitude && def.amplitude.ideal === def.amplitude.minimo_aceito) {
      problemas.push("amplitude: ideal e minimo_aceito não podem ser iguais");
    }
    for (const erro of def.erros ?? []) {
      if (erro.fase && !nomesFases.has(erro.fase)) problemas.push(`erro ${erro.id}: fase inexistente "${erro.fase}"`);
    }
  } else if (def.formato === "alternado") {
    if (!def.alternado) problemas.push("falta o bloco alternado");
    else {
      conferirCondicao("alternado.e", def.alternado.e, false);
      conferirCondicao("alternado.d", def.alternado.d, false);
      if (def.alternado.quase_e) conferirCondicao("alternado.quase_e", def.alternado.quase_e, false);
      if (def.alternado.quase_d) conferirCondicao("alternado.quase_d", def.alternado.quase_d, false);
    }
  } else if (def.formato === "precisao") {
    if (!def.alvos) problemas.push("falta o bloco alvos");
    else {
      tentar("alvos.pontos", () => def.alvos!.pontos.forEach((n) => indicesDoPonto(n)));
      if (!(def.alvos.tempo_ms > 0) || !(def.alvos.raio > 0)) problemas.push("alvos: tempo_ms e raio precisam ser positivos");
    }
  } else if (SUSTENTACAO.has(def.formato)) {
    if (!def.sustentacao) problemas.push("falta o bloco sustentacao");
    else {
      conferirCondicao("sustentacao.condicao", def.sustentacao.condicao, false);
      const lado = def.sustentacao.lado;
      if (lado && !nomes.has(lado.medida)) problemas.push(`sustentacao.lado: medida desconhecida "${lado.medida}"`);
      const controle = def.sustentacao.controle;
      if (controle) {
        tentar("sustentacao.controle", () => {
          indicesDoPonto(controle.ponto);
          controle.normalizar_por.forEach((n) => indicesDoPonto(n));
        });
      }
    }
  } else {
    problemas.push(`formato desconhecido "${def.formato}"`);
  }

  for (const erro of def.erros ?? []) {
    conferirCondicao(`erro ${erro.id}`, erro.condicao, erro.quando === "fim_rep");
    if (erro.invalida && erro.quando !== "fim_rep") problemas.push(`erro ${erro.id}: "invalida" só vale com quando = fim_rep`);
    if (erro.pontos) tentar(`erro ${erro.id}: pontos`, () => erro.pontos!.forEach((n) => indicesDoPonto(n)));
  }

  return problemas;
}

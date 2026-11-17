// Gera supabase/seed_trilha.sql: os 19 exercícios do catálogo (seção 7), as 24
// unidades (3 por nível) e os desafios de cada unidade, seguindo a ordem
// fisiológica da seção 6.2. Cada desafio é uma lista de blocos com as variáveis
// metodológicas (docs/METODOS.md). Rode com: npm run seed:trilha
//
// O conteúdo é um RASCUNHO para revisão do Luan: nomes das unidades, escolha
// dos exercícios, métodos e números. A escala pela dificuldade pessoal entra depois.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  compilar, DURACAO_MAXIMA_S, PAUSA_ENTRE_BLOCOS_PADRAO, segundosPorBloco, validarEstrutura,
  type Bloco, type Estrutura, type ExercicioMetodo,
} from "../src/dominio/metodos";

const raiz = path.resolve(__dirname, "..");

interface Exercicio {
  id: string;
  nome: string;
  modalidade: string;
  camera: "frontal" | "lateral";
  equipamento: "tapete" | "cabo_vassoura" | null;
  formato: string;
  /** Exercício de chão: pede tapete a partir do nível 5 (seção 7). */
  chao?: boolean;
}

export const EXERCICIOS: Exercicio[] = [
  { id: "agachamento_livre", nome: "Agachamento livre", modalidade: "forca", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "afundo_alternado", nome: "Afundo alternado", modalidade: "forca", camera: "lateral", equipamento: null, formato: "repeticoes" },
  { id: "flexao_braco", nome: "Flexão de braço", modalidade: "forca", camera: "lateral", equipamento: null, formato: "repeticoes", chao: true },
  { id: "ponte_gluteo", nome: "Ponte de glúteo", modalidade: "forca", camera: "lateral", equipamento: null, formato: "repeticoes", chao: true },
  { id: "prancha", nome: "Prancha", modalidade: "core", camera: "lateral", equipamento: null, formato: "isometria", chao: true },
  { id: "polichinelo", nome: "Polichinelo", modalidade: "cardio", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "skipping", nome: "Skipping (elevação de joelhos)", modalidade: "cardio", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "mountain_climber", nome: "Mountain climber", modalidade: "condicionamento", camera: "lateral", equipamento: null, formato: "repeticoes", chao: true },
  { id: "elevacao_bracos_y", nome: "Elevação de braços em Y", modalidade: "mobilidade", camera: "frontal", equipamento: null, formato: "mobilidade" },
  { id: "alongamento_posterior", nome: "Alongamento de posterior em pé", modalidade: "alongamento", camera: "lateral", equipamento: null, formato: "isometria" },
  { id: "marcha_estacionaria", nome: "Marcha estacionária com braços", modalidade: "aquecimento", camera: "frontal", equipamento: null, formato: "repeticoes" },
  { id: "guerreiro_2", nome: "Guerreiro II", modalidade: "yoga", camera: "frontal", equipamento: null, formato: "postura" },
  { id: "postura_arvore", nome: "Postura da árvore", modalidade: "yoga", camera: "frontal", equipamento: null, formato: "postura" },
  { id: "cachorro_olhando_baixo", nome: "Cachorro olhando para baixo", modalidade: "yoga", camera: "lateral", equipamento: "tapete", formato: "postura", chao: true },
  { id: "apoio_uma_perna", nome: "Apoio em uma perna", modalidade: "equilibrio", camera: "frontal", equipamento: null, formato: "equilibrio" },
  { id: "toque_alvos", nome: "Toque nos alvos", modalidade: "precisao", camera: "frontal", equipamento: null, formato: "precisao" },
  { id: "respiracao_guiada", nome: "Respiração guiada", modalidade: "respiracao", camera: "frontal", equipamento: null, formato: "respiracao" },
  { id: "agachamento_bastao", nome: "Agachamento com bastão acima da cabeça", modalidade: "mobilidade", camera: "frontal", equipamento: "cabo_vassoura", formato: "mobilidade" },
  { id: "bom_dia_bastao", nome: "Bom-dia com bastão", modalidade: "forca", camera: "lateral", equipamento: "cabo_vassoura", formato: "repeticoes" },
];

/** 3 unidades temáticas por nível. */
export const UNIDADES: Record<number, [string, string][]> = {
  1: [["Acordando o corpo", "Os primeiros movimentos, sem pressa."], ["Pernas firmes", "A base de tudo: agachar e sustentar."], ["Fôlego novo", "Um pouco mais de ritmo a cada dia."]],
  2: [["Agachar bem", "Técnica antes de quantidade."], ["Tronco estável", "Centro do corpo forte e alinhado."], ["Ritmo constante", "Manter o passo do começo ao fim."]],
  3: [["Um pé de cada vez", "Equilíbrio em uma perna."], ["Centro forte", "CORE para segurar qualquer movimento."], ["Controle total", "Devagar e bem feito."]],
  4: [["Passo marcado", "Cadência e coordenação."], ["Coração acelerado", "Condicionamento em blocos curtos."], ["Sem perder o compasso", "Ritmo com técnica."]],
  5: [["No tapete", "Hora de ir para o chão."], ["Prancha e ponte", "Força de tronco e glúteos."], ["Força de chão", "Empurrar o próprio peso."]],
  6: [["Explosão", "Mais velocidade, mesma qualidade."], ["Empurrar e subir", "Braços e pernas trabalhando juntos."], ["Motor ligado", "Sessões longas de fôlego."]],
  7: [["Com o bastão", "O cabo de vassoura entra no treino."], ["Ombros livres", "Amplitude acima da cabeça."], ["Quadril solto", "Mobilidade de posterior e quadril."]],
  8: [["Tudo junto", "Todos os movimentos numa sessão."], ["No limite", "Seu melhor em cada desafio."], ["Colmeia completa", "A última unidade da trilha."]],
};

interface Posicao {
  titulo: string;
  modalidade: string;
  duracao: number;
  intensidade: "baixa" | "media" | "alta";
  /** Fora dos níveis de 8 desafios (marcado com * na seção 6.2). */
  opcionalEm8?: boolean;
  /** Só nos níveis de 12 desafios (marcado com † na seção 6.2). */
  extraEm12?: boolean;
  /** Opções de exercícios; a escolha gira por unidade. */
  opcoes: (nivel: number) => string[][];
}

/** Ordem fisiológica da seção 6.2. */
const MODELO: Posicao[] = [
  { titulo: "Aquecimento", modalidade: "aquecimento", duracao: 210, intensidade: "baixa", opcoes: () => [["marcha_estacionaria", "polichinelo"], ["marcha_estacionaria", "skipping"], ["marcha_estacionaria", "elevacao_bracos_y"]] },
  { titulo: "Mobilidade articular", modalidade: "mobilidade", duracao: 270, intensidade: "baixa", opcoes: (n) => (n >= 7 ? [["agachamento_bastao", "elevacao_bracos_y"], ["elevacao_bracos_y", "agachamento_bastao"]] : [["elevacao_bracos_y", "alongamento_posterior"], ["elevacao_bracos_y", "guerreiro_2"]]) },
  { titulo: "Equilíbrio", modalidade: "equilibrio", duracao: 210, intensidade: "baixa", opcionalEm8: true, opcoes: () => [["apoio_uma_perna"], ["postura_arvore", "apoio_uma_perna"], ["apoio_uma_perna", "postura_arvore"]] },
  { titulo: "Precisão", modalidade: "precisao", duracao: 210, intensidade: "media", extraEm12: true, opcoes: () => [["toque_alvos"]] },
  { titulo: "Força de pernas", modalidade: "forca", duracao: 300, intensidade: "media", opcoes: (n) => (n >= 7 ? [["agachamento_livre", "bom_dia_bastao"], ["afundo_alternado", "bom_dia_bastao"], ["agachamento_livre", "afundo_alternado"]] : [["agachamento_livre", "afundo_alternado"], ["agachamento_livre"], ["afundo_alternado", "agachamento_livre"]]) },
  { titulo: "Força de tronco e braços", modalidade: "forca", duracao: 300, intensidade: "media", opcionalEm8: true, opcoes: () => [["flexao_braco", "ponte_gluteo"], ["ponte_gluteo", "flexao_braco"]] },
  { titulo: "CORE", modalidade: "core", duracao: 270, intensidade: "media", opcoes: (n) => (n >= 3 ? [["prancha", "mountain_climber"], ["prancha", "ponte_gluteo"]] : [["prancha", "ponte_gluteo"], ["ponte_gluteo", "prancha"]]) },
  { titulo: "Condicionamento", modalidade: "condicionamento", duracao: 300, intensidade: "alta", opcoes: (n) => (n >= 3 ? [["skipping", "polichinelo"], ["mountain_climber", "skipping"], ["polichinelo", "mountain_climber"]] : [["skipping", "polichinelo"], ["polichinelo", "skipping"]]) },
  { titulo: "HIIT", modalidade: "hiit", duracao: 270, intensidade: "alta", opcoes: (n) => (n >= 3 ? [["polichinelo", "agachamento_livre", "skipping"], ["skipping", "mountain_climber", "polichinelo"]] : [["polichinelo", "agachamento_livre", "skipping"], ["skipping", "agachamento_livre", "polichinelo"]]) },
  { titulo: "Mobilidade dinâmica", modalidade: "mobilidade", duracao: 270, intensidade: "baixa", extraEm12: true, opcoes: (n) => (n >= 7 ? [["agachamento_bastao", "guerreiro_2"], ["guerreiro_2", "agachamento_bastao"]] : [["guerreiro_2", "elevacao_bracos_y"], ["elevacao_bracos_y", "guerreiro_2"]]) },
  { titulo: "Yoga e alongamento", modalidade: "yoga", duracao: 300, intensidade: "baixa", opcoes: (n) => (n >= 5 ? [["cachorro_olhando_baixo", "guerreiro_2", "alongamento_posterior"], ["guerreiro_2", "postura_arvore", "cachorro_olhando_baixo"]] : [["guerreiro_2", "postura_arvore", "alongamento_posterior"], ["postura_arvore", "guerreiro_2", "alongamento_posterior"]]) },
  { titulo: "Volta à calma e respiração", modalidade: "respiracao", duracao: 270, intensidade: "baixa", opcoes: () => [["alongamento_posterior", "respiracao_guiada"], ["respiracao_guiada"]] },
];

const FINAL: Posicao = {
  titulo: "Desafio da unidade",
  modalidade: "desafio_final",
  duracao: 300,
  intensidade: "media",
  opcoes: (n) => (n >= 3 ? [["agachamento_livre", "prancha", "polichinelo"], ["afundo_alternado", "mountain_climber", "skipping"], ["agachamento_livre", "flexao_braco", "polichinelo"]] : [["agachamento_livre", "prancha", "polichinelo"], ["agachamento_livre", "ponte_gluteo", "skipping"], ["afundo_alternado", "prancha", "polichinelo"]]),
};

/** Desafios por unidade em cada nível (seção 6.1): 8, 8, 10, 10, 10, 12, 12, 12. */
const DESAFIOS_POR_NIVEL: Record<number, number> = { 1: 8, 2: 8, 3: 10, 4: 10, 5: 10, 6: 12, 7: 12, 8: 12 };

const txt = (valor: string | null) => (valor === null ? "null" : `'${valor.replace(/'/g, "''")}'`);

function posicoesDoNivel(nivel: number): Posicao[] {
  const total = DESAFIOS_POR_NIVEL[nivel];
  return MODELO.filter((p) => (total === 8 ? !p.opcionalEm8 && !p.extraEm12 : total === 10 ? !p.extraEm12 : true));
}

const SUSTENTACAO = new Set(["isometria", "postura", "equilibrio", "respiracao"]);

function paraMetodo(e: Exercicio): ExercicioMetodo {
  const def = JSON.parse(readFileSync(path.join(raiz, "src", "exercicios", `${e.id}.json`), "utf8")) as { seg_por_rep?: number };
  return { nome: e.nome, sustentacao: SUSTENTACAO.has(e.formato), segPorRep: def.seg_por_rep ?? 3, lateral: e.camera === "lateral" };
}

/** Repetições que levam cerca de `segundos` no ritmo de referência (par, para os alternados), até 40. */
const repsPara = (segundos: number, ex: ExercicioMetodo) => Math.min(40, Math.max(4, Math.round(segundos / ex.segPorRep / 2) * 2));

type Variaveis = Pick<Bloco, "pse_alvo" | "cadencia" | "adm" | "acao">;

/** Bloco por tempo: isometria para sustentação, AMRAP para o resto. */
function porTempo(id: string, ex: ExercicioMetodo, series: number, esforco: number, pausa: number, v: Variaveis): Bloco {
  return ex.sustentacao
    ? { exercicio_id: id, metodo: "isometria", series, esforco_s: esforco, pausa_s: pausa, score: "tempo_valido", ...v, acao: "isometrica", cadencia: undefined }
    : { exercicio_id: id, metodo: "amrap", series, esforco_s: esforco, pausa_s: pausa, score: "total_reps", ...v };
}

/** Bloco de repetições (ou isometria, se o exercício for de sustentação). */
function porReps(id: string, ex: ExercicioMetodo, series: number, reps: number | number[], pausa: number, v: Variaveis, segundosIso = 30): Bloco {
  if (ex.sustentacao) return porTempo(id, ex, series, segundosIso, pausa, v);
  return { exercicio_id: id, metodo: "reps", series, reps_alvo: reps, pausa_s: pausa, score: Array.isArray(reps) ? "total_reps" : "reps_por_serie", ...v };
}

/** Quantas séries cabem para o exercício i quando `total` se alternam entre `n`. */
const fatia = (total: number, n: number, i: number) => Math.floor(total / n) + (i < total % n ? 1 : 0);

/**
 * Estrutura de cada posição da unidade (docs/METODOS.md, seção 3), com as
 * variáveis metodológicas. A progressão entre seções segue volume → densidade:
 * mais reps ou segundos, depois menos pausa.
 */
function escolherEstrutura(p: Posicao, nivel: number, unidade: number, ids: string[], ex: ExercicioMetodo[]): Estrutura {
  const pr = Math.min(3, Math.floor((nivel - 1) / 2));
  const n = ex.length;
  const seq = (blocos: Bloco[], extra: Partial<Estrutura> = {}): Estrutura => ({ versao: 2, organizacao: "sequencia", pausa_entre_blocos_s: PAUSA_ENTRE_BLOCOS_PADRAO, blocos, ...extra });
  const alt = (blocos: Bloco[], pausaRodada: number, extra: Partial<Estrutura> = {}): Estrutura => ({ versao: 2, organizacao: "alternada", pausa_entre_blocos_s: pausaRodada, blocos, ...extra });
  const leve: Variaveis = { adm: "completa", acao: "mista" };

  switch (p.modalidade) {
    case "aquecimento":
      // Intervalado alternado 30/10 com faixa de reps (60% a 90% do ritmo de referência).
      return alt(ex.map((e, i) => {
        const b = porTempo(ids[i], e, 3, 30, 10, { ...leve, pse_alvo: 3 });
        if (b.metodo === "amrap") b.faixa = { min: Math.round((30 / e.segPorRep) * 0.6), max: Math.round((30 / e.segPorRep) * 0.9) };
        return b;
      }), 10);
    case "mobilidade":
      // Movimento lento e controlado: repetições com cadência 3-0-3-0.
      return seq(ex.map((e, i) => porReps(ids[i], e, 2, [6, 8, 8, 10][pr], 15, { ...leve, pse_alvo: 3, cadencia: e.sustentacao ? undefined : "3-0-3-0" }, [20, 25, 30, 30][pr])), { pausa_entre_blocos_s: 15 });
    case "equilibrio":
      return alt(ex.map((e, i) => porTempo(ids[i], e, fatia(4, n, i), [20, 25, 30, 40][pr], 10, { pse_alvo: 4, adm: "completa", acao: "isometrica" })), 10);
    case "precisao":
      return seq(ex.map((e, i) => porTempo(ids[i], e, 4, [30, 30, 40, 40][pr], 15, { ...leve, pse_alvo: 4 })));
    case "forca": {
      const tronco = p.titulo.includes("tronco");
      const v: Variaveis = { pse_alvo: [6, 6, 7, 7][pr], cadencia: pr < 2 ? "2-0-1-0" : "3-0-1-0", adm: "completa", acao: "mista" };
      // Terceira unidade de cada seção: EMOM, para variar o estímulo de força.
      if (unidade === 2 && ex.every((e) => !e.sustentacao)) {
        const reps = Math.min(...ex.map((e) => repsPara([20, 25, 30, 30][pr], e)));
        return alt(ex.map((e, i) => ({ exercicio_id: ids[i], metodo: "emom" as const, series: fatia(4, n, i), reps_alvo: reps, pausa_s: 0, score: "reps_por_serie" as const, ...v, pse_alvo: 7, cadencia: undefined })), 0);
      }
      const reps = (tronco ? [6, 8, 10, 12] : [8, 10, 12, 15])[pr];
      const pausa = [60, 45, 45, 30][pr];
      return seq(ex.map((e, i) => porReps(ids[i], e, n === 1 ? 3 : 2, e.segPorRep < 1.5 ? repsPara(reps * 3, e) : reps, pausa, v)), { pausa_entre_blocos_s: pausa });
    }
    case "core":
      // Pedido do Luan (n6u1d07): isometria e AMRAP em sequência, 3 séries com pausa de 20 s.
      return seq(ex.map((e, i) => porTempo(ids[i], e, 3, [20, 25, 30, 30][pr], 20, { pse_alvo: 6, adm: "completa", acao: e.sustentacao ? "isometrica" : "mista" })));
    case "condicionamento":
      return unidade % 2 === 0
        ? alt(ex.map((e, i) => porTempo(ids[i], e, 3, [20, 25, 30, 30][pr], 0, { ...leve, pse_alvo: 7 })), 20)
        : alt(ex.map((e, i) => porTempo(ids[i], e, fatia(6, n, i), [30, 40, 40, 45][pr], [20, 20, 15, 15][pr], { ...leve, pse_alvo: 7 })), 0);
    case "hiit":
      return alt(ex.map((e, i) => ({ exercicio_id: ids[i], metodo: "tabata" as const, series: fatia(8, n, i), esforco_s: 20, pausa_s: 10, score: "total_reps" as const, ...leve, pse_alvo: 8 })), 0);
    case "yoga":
      return alt(ex.map((e, i) => porTempo(ids[i], e, 2, [30, 30, 40, 45][pr], 10, { pse_alvo: 3, adm: "completa", acao: "isometrica" })), 10);
    case "respiracao": {
      const resp = ex.findIndex((e) => e.nome.startsWith("Respiração"));
      return seq(ex.map((e, i) => porTempo(ids[i], e, 1, i === resp ? (n === 1 ? 240 : 180) : 60, 0, { pse_alvo: 2, acao: "isometrica" })), { pausa_entre_blocos_s: 0 });
    }
    case "desafio_final": {
      const v: Variaveis = { ...leve, pse_alvo: 7 };
      if (unidade === 0) {
        // Contra o relógio: uma lista de tarefas, teto de 4 min.
        return seq(ex.map((e, i) => (e.sustentacao
          ? porTempo(ids[i], e, 1, [30, 35, 40, 45][pr], 0, v)
          : { exercicio_id: ids[i], metodo: "for_time" as const, series: 1, reps_alvo: repsPara([30, 35, 40, 45][pr], e), pausa_s: 0, score: "tempo_total" as const, ...v })), { pausa_entre_blocos_s: 0, teto_s: 240 });
      }
      if (unidade === 1 && n === 1) {
        // Escada: a meta muda a cada série, sem pausa, teto de 4 min.
        const fator = ex[0].segPorRep < 1.5 ? 2 : 1;
        const degraus = [[2, 4, 6, 8], [2, 4, 6, 8, 10], [4, 6, 8, 10, 12], [4, 8, 12, 16, 20]][pr].map((d) => d * fator);
        return seq([porReps(ids[0], ex[0], degraus.length, degraus, 0, v)], { pausa_entre_blocos_s: 0, teto_s: 240 });
      }
      // Circuito: 3 rodadas sem pausa entre exercícios, 20 s entre rodadas.
      return alt(ex.map((e, i) => porReps(ids[i], e, 3, repsPara([20, 25, 30, 30][pr], e), 0, v, [20, 25, 30, 30][pr])), 20);
    }
  }
  throw new Error(`Posição sem estrutura: ${p.modalidade}`);
}

/** Reduz o volume até o desafio caber em 5 minutos, contando as pausas. */
function encaixar(e: Estrutura, ex: ExercicioMetodo[]): Estrutura {
  let atual = e;
  for (let i = 0; i < 60 && compilar(atual, ex).duracaoEstimadaS > DURACAO_MAXIMA_S; i++) {
    const a = structuredClone(atual);
    // Tira uma série do bloco com mais séries; sem séries para tirar, encurta esforço ou reps.
    const maior = a.blocos.reduce((m, b, j) => (b.series > a.blocos[m].series ? j : m), 0);
    const b = a.blocos[maior];
    if (b.series > 2 && !Array.isArray(b.reps_alvo)) b.series--;
    else
      a.blocos.forEach((x) => {
        if (x.esforco_s) x.esforco_s = Math.max(10, x.esforco_s - 5);
        else if (typeof x.reps_alvo === "number") x.reps_alvo = Math.max(4, x.reps_alvo - 2);
        x.pausa_s = Math.max(0, x.pausa_s - 5);
      });
    atual = a;
  }
  return atual;
}

export interface DesafioGerado {
  id: string;
  nivel: number;
  unidade: string;
  ordem: number;
  posicao: Posicao;
  tipo: "desafio" | "final";
  exercicios: Exercicio[];
  estrutura: Estrutura;
  duracaoS: number;
  segundosPorBloco: number[];
  equipamento: string | null;
}

/** Todo o conteúdo da trilha, com estruturas validadas e dentro dos 5 minutos. */
export function conteudoTrilha(): DesafioGerado[] {
  const porId = new Map(EXERCICIOS.map((e) => [e.id, e]));
  const lista: DesafioGerado[] = [];
  for (const nivel of Object.keys(UNIDADES).map(Number)) {
    UNIDADES[nivel].forEach((_, iu) => {
      const unidade = `n${nivel}u${iu + 1}`;
      const itens = [...posicoesDoNivel(nivel).map((p) => ({ p, tipo: "desafio" as const })), { p: FINAL, tipo: "final" as const }];
      itens.forEach(({ p, tipo }, i) => {
        const ordem = i + 1;
        const id = tipo === "final" ? `${unidade}final` : `${unidade}d${String(ordem).padStart(2, "0")}`;
        const opcoes = p.opcoes(nivel);
        let escolhidos = opcoes[(iu + nivel) % opcoes.length].map((e) => porId.get(e)!);
        // Desafio da segunda unidade: escada com o primeiro exercício de repetição.
        if (tipo === "final" && iu === 1) escolhidos = [escolhidos.find((e) => !SUSTENTACAO.has(e.formato))!];
        const ex = escolhidos.map(paraMetodo);
        const ids = escolhidos.map((e) => e.id);
        const estrutura = encaixar(escolherEstrutura(p, nivel, iu, ids, ex), ex);
        const problemas = validarEstrutura(estrutura, ex);
        if (problemas.length) throw new Error(`${id}: ${problemas.join("; ")}`);
        const linha = compilar(estrutura, ex);
        const equipamento = escolhidos.some((e) => e.equipamento === "cabo_vassoura")
          ? "cabo_vassoura"
          : escolhidos.some((e) => e.equipamento === "tapete" || (e.chao && nivel >= 5))
            ? "tapete"
            : null;
        lista.push({
          id, nivel, unidade, ordem, posicao: p, tipo, exercicios: escolhidos, estrutura,
          duracaoS: Math.max(30, linha.duracaoEstimadaS), segundosPorBloco: segundosPorBloco(linha, ex), equipamento,
        });
      });
    });
  }
  return lista;
}

export function gerarSeedTrilha(): string {
  const linhas: string[] = [
    "-- Hive Break · Seed da trilha: exercícios, unidades, desafios e blocos.",
    "-- GERADO por scripts/gerar-seed-trilha.ts: não edite à mão. Pode ser rodado",
    "-- mais de uma vez (atualiza o que já existe). Precisa da migração 0009 (coluna estrutura).",
    "",
    "insert into public.exercises (id, nome, modalidade, camera, definicao, equipamento) values",
  ];
  linhas.push(
    EXERCICIOS.map((e) => {
      // A definição de cada exercício vem do arquivo JSON que o motor usa.
      const definicao = JSON.stringify(JSON.parse(readFileSync(path.join(raiz, "src", "exercicios", `${e.id}.json`), "utf8")));
      return `  (${txt(e.id)}, ${txt(e.nome)}, ${txt(e.modalidade)}, ${txt(e.camera)}, ${txt(definicao)}::jsonb, ${txt(e.equipamento)})`;
    }).join(",\n") +
      "\non conflict (id) do update set nome = excluded.nome, modalidade = excluded.modalidade, camera = excluded.camera,\n  definicao = excluded.definicao, equipamento = excluded.equipamento;",
    "",
  );

  const unidades: string[] = [];
  for (const nivel of Object.keys(UNIDADES).map(Number)) {
    UNIDADES[nivel].forEach(([titulo, descricao], iu) => {
      unidades.push(`  (${txt(`n${nivel}u${iu + 1}`)}, ${nivel}, ${iu + 1}, ${txt(titulo)}, ${txt(descricao)})`);
    });
  }
  const desafios: string[] = [];
  const blocos: string[] = [];
  for (const d of conteudoTrilha()) {
    const p = d.posicao;
    desafios.push(
      `  (${txt(d.id)}, ${d.nivel}, ${txt(d.unidade)}, ${d.ordem}, ${txt(p.titulo)}, ${txt(p.modalidade)}, ${d.duracaoS}, ${txt(p.intensidade)}, ${txt(d.equipamento)}, ${!!p.opcionalEm8}, ${!!p.extraEm12}, ${txt(d.tipo)}, null, ${txt(JSON.stringify(d.estrutura))}::jsonb)`,
    );
    d.estrutura.blocos.forEach((bl, ib) => {
      const e = d.exercicios[ib];
      const formato = bl.metodo === "tabata" ? "intervalado" : bl.metodo === "amrap" ? "amrap" : bl.metodo === "isometria" ? e.formato : "repeticoes";
      blocos.push(
        `  (${txt(`${d.id}b${ib + 1}`)}, ${txt(d.id)}, ${ib + 1}, ${txt(e.id)}, ${txt(formato)}, ${bl.series}, ${txt(JSON.stringify({ padrao: { segundos: d.segundosPorBloco[ib] } }))}::jsonb, ${bl.pausa_s})`,
      );
    });
  }

  linhas.push(
    "insert into public.units (id, level_id, ordem, titulo, descricao) values",
    unidades.join(",\n") + "\non conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, ordem = excluded.ordem;",
    "",
    "insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, equipamento, opcional_em_8, extra_em_12, tipo, metodo, estrutura) values",
    desafios.join(",\n") +
      "\non conflict (id) do update set ordem = excluded.ordem, titulo = excluded.titulo, modalidade = excluded.modalidade,\n  duracao_s = excluded.duracao_s, intensidade = excluded.intensidade, equipamento = excluded.equipamento, tipo = excluded.tipo,\n  metodo = excluded.metodo, estrutura = excluded.estrutura;",
    "",
    "insert into public.challenge_blocks (id, challenge_id, ordem, exercise_id, formato, series, parametros_por_dificuldade, descanso_s) values",
    blocos.join(",\n") +
      "\non conflict (id) do update set exercise_id = excluded.exercise_id, formato = excluded.formato, series = excluded.series,\n  parametros_por_dificuldade = excluded.parametros_por_dificuldade, descanso_s = excluded.descanso_s;\n\n-- Blocos que sobraram de versões antigas do conteúdo.\ndelete from public.challenge_blocks b using public.challenges c\nwhere b.challenge_id = c.id and c.estrutura is not null and b.ordem > jsonb_array_length(c.estrutura -> 'blocos')\n  and not exists (select 1 from public.attempt_blocks ab where ab.challenge_block_id = b.id);",
    "",
  );
  return linhas.join("\n");
}

if (require.main === module) {
  writeFileSync(path.join(raiz, "supabase", "seed_trilha.sql"), gerarSeedTrilha());
  console.log("supabase/seed_trilha.sql atualizado");
}

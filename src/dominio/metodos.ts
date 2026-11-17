/**
 * Estrutura dos desafios (docs/METODOS.md).
 *
 * Um desafio é uma lista de BLOCOS, um por exercício, cada um com as variáveis
 * metodológicas do treino: método, séries, esforço (s) ou reps-alvo, pausa,
 * score, PSE alvo, cadência, ADM e ação muscular. Os blocos rodam em
 * sequência (A, A, A, depois B, B, B) ou alternados (A, B, A, B: circuito e
 * Tabata com mais de um exercício).
 *
 * `compilar` transforma a estrutura numa linha do tempo de fases (preparo,
 * trabalho, descanso, transição) que a tela percorre com ou sem câmera.
 * Código puro, testado sem navegador.
 */

// ===================================================================== modelo

export type MetodoBloco = "amrap" | "isometria" | "reps" | "emom" | "tabata" | "for_time";

/** O que mede o resultado do bloco. */
export type Score = "total_reps" | "tempo_valido" | "tempo_total" | "reps_por_serie";

export type Adm = "completa" | "parcial";
export type Acao = "concentrica" | "excentrica" | "isometrica" | "mista";

export interface Bloco {
  /** Exercício (id do catálogo). O bloco de posição i corresponde ao challenge_block de ordem i + 1. */
  exercicio_id: string;
  metodo: MetodoBloco;
  series: number;
  /** Tempo de esforço de cada série (AMRAP, isometria, Tabata). */
  esforco_s?: number;
  /** Repetições de cada série (reps, EMOM, contra o relógio). Uma lista é uma escada (uma meta por série). */
  reps_alvo?: number | number[];
  /** Faixa de repetições no AMRAP (controle de ritmo). */
  faixa?: { min: number; max: number };
  /** Pausa entre as séries do bloco. */
  pausa_s: number;
  score: Score;
  /** Percepção de esforço esperada, de 1 a 10. */
  pse_alvo?: number;
  /** Cadência em segundos: excêntrica-pausa embaixo-concêntrica-pausa em cima, ex.: "2-0-1-0". */
  cadencia?: string;
  /** Amplitude de movimento. */
  adm?: Adm;
  /** Ação muscular predominante. */
  acao?: Acao;
}

export interface Estrutura {
  versao: 2;
  organizacao: "sequencia" | "alternada";
  /** Sequência: pausa entre um bloco e o próximo. Alternada: pausa ao fim de cada rodada. */
  pausa_entre_blocos_s: number;
  /** Teto de tempo do desafio (contra o relógio, escada). */
  teto_s?: number;
  blocos: Bloco[];
}

/** Pausa entre blocos quando não informada (pedido do Luan). */
export const PAUSA_ENTRE_BLOCOS_PADRAO = 20;
/** Contagem do pop-up "PREPARE-SE" (configurável de 5 a 10 s no perfil). */
export const PREPARO_PADRAO_S = 10;
export const TRANSICAO_MS = 3000;
/** Limite de um desafio (decisão do Luan: inclui os descansos). */
export const DURACAO_MAXIMA_S = 300;

/** O que a estrutura precisa saber de cada exercício. */
export interface ExercicioMetodo {
  nome: string;
  /** Exercício de sustentação (isometria, postura, equilíbrio, respiração): mede tempo, não reps. */
  sustentacao: boolean;
  /** Ritmo de referência, em segundos por repetição (estimativa de duração). */
  segPorRep: number;
  /** Exercício feito de lado para o celular. */
  lateral?: boolean;
}

// ===================================================================== fases

export type Fase =
  /** Pop-up "PREPARE-SE" antes do primeiro esforço de cada bloco, com contagem regressiva. */
  | { tipo: "preparo"; exercicio: number; duracaoMs: number }
  /** Troca de exercício sem pausa no meio (circuito, contra o relógio). */
  | { tipo: "transicao"; exercicio: number; duracaoMs: number }
  | { tipo: "descanso"; duracaoMs: number; proximo: number; rotuloProximo: string }
  | FaseTrabalho;

export interface FaseTrabalho {
  tipo: "trabalho";
  /** Índice do bloco (= exercício) no desafio. */
  exercicio: number;
  serie: number;
  totalSeries: number;
  metodo: MetodoBloco;
  /** Ex.: "2ª série de 3", "Round 5 de 8", "Minuto 2 de 4". */
  rotulo: string;
  /** Tempo fixo da fase. Ausente: termina ao completar `alvoReps`. */
  duracaoMs?: number;
  alvoReps?: number;
  faixa?: { min: number; max: number };
  /** Fase de sustentação: o que conta é o tempo na posição. */
  sustentar: boolean;
  /** EMOM: ao bater o alvo antes do fim do minuto, o resto vira descanso. */
  emom?: boolean;
}

export interface LinhaDoTempo {
  estrutura: Estrutura;
  fases: Fase[];
  tetoMs?: number;
  /** Duração planejada (s): esforços + pausas, sem a contagem inicial; limitada pelo teto. */
  duracaoEstimadaS: number;
}

// ===================================================================== textos

export const NOME_METODO: Record<MetodoBloco, string> = {
  amrap: "AMRAP",
  isometria: "Isometria",
  reps: "Repetições",
  emom: "EMOM",
  tabata: "Tabata",
  for_time: "Contra o relógio",
};

export const ROTULO_SCORE: Record<Score, string> = {
  total_reps: "total de repetições",
  tempo_valido: "segundos em posição",
  tempo_total: "tempo para completar",
  reps_por_serie: "repetições por série",
};

export const ROTULO_ACAO: Record<Acao, string> = {
  concentrica: "concêntrica",
  excentrica: "excêntrica",
  isometrica: "isométrica",
  mista: "mista",
};

/** Explicações curtas das variáveis, para o "O que é isso?". */
export const GLOSSARIO: { termo: string; texto: string }[] = [
  { termo: "AMRAP", texto: "O máximo de repetições bem feitas no tempo da série." },
  { termo: "Isometria", texto: "Segurar a posição. O tempo só conta com a postura certa." },
  { termo: "Repetições", texto: "Uma meta de repetições por série; a série termina quando você completa." },
  { termo: "EMOM", texto: "A cada minuto, faça as repetições pedidas; o que sobrar do minuto é descanso." },
  { termo: "Tabata", texto: "Rounds curtos e intensos: 20 s de esforço e 10 s de pausa." },
  { termo: "Contra o relógio", texto: "Complete tudo no menor tempo, dentro do teto." },
  { termo: "Escada", texto: "A meta de repetições muda a cada série (ex.: 2-4-6-8)." },
  { termo: "PSE", texto: "Percepção subjetiva de esforço, de 1 (muito leve) a 10 (máximo). Indica o quanto o desafio deve cansar." },
  { termo: "Cadência", texto: "Segundos de cada fase: descida, pausa embaixo, subida, pausa em cima. 2-0-1-0 = desça em 2 s e suba em 1 s." },
  { termo: "ADM", texto: "Amplitude de movimento: completa (todo o movimento) ou parcial (só uma parte)." },
  { termo: "Ação", texto: "Concêntrica (músculo encurta), excêntrica (alonga sob controle), isométrica (parado) ou mista." },
  { termo: "Densidade", texto: "Esforço:pausa. 2:1 = o dobro de tempo trabalhando do que descansando." },
];

const ordinal = (n: number) => `${n}ª`;
const ehEscada = (b: Bloco) => Array.isArray(b.reps_alvo);
const repsDaSerie = (b: Bloco, s: number) => (Array.isArray(b.reps_alvo) ? b.reps_alvo[s] : (b.reps_alvo ?? 0));

/** Nome do método do bloco, com "Escada" quando a meta muda a cada série. */
export function nomeDoBloco(b: Bloco): string {
  return ehEscada(b) ? "Escada" : NOME_METODO[b.metodo];
}

/** Esforço:pausa simplificado (ex.: 40:20 → "2:1"). Só para blocos por tempo com pausa. */
export function densidade(b: Bloco): string | null {
  if (!b.esforco_s || !b.pausa_s) return null;
  const mdc = (a: number, c: number): number => (c === 0 ? a : mdc(c, a % c));
  const d = mdc(b.esforco_s, b.pausa_s);
  return `${b.esforco_s / d}:${b.pausa_s / d}`;
}

/**
 * Linha do card do bloco, ex.: "AMRAP · 5 × 40 s · pausa 20 s · de frente para o celular".
 */
export function descreverBloco(b: Bloco, ex?: ExercicioMetodo): string {
  const partes: string[] = [nomeDoBloco(b)];
  if (ehEscada(b)) partes.push(`${(b.reps_alvo as number[]).join("-")} reps`);
  else if (b.metodo === "emom") partes.push(`${b.series} × ${b.reps_alvo} reps por minuto`);
  else if (b.reps_alvo !== undefined) partes.push(`${b.series > 1 ? `${b.series} × ` : ""}${b.reps_alvo} reps`);
  else partes.push(`${b.series > 1 ? `${b.series} × ` : ""}${b.esforco_s} s`);
  if (b.faixa) partes.push(`meta ${b.faixa.min} a ${b.faixa.max} reps`);
  if (b.series > 1 && b.metodo !== "emom") partes.push(b.pausa_s > 0 ? `pausa ${b.pausa_s} s` : "sem pausa");
  if (ex) partes.push(ex.lateral ? "de lado para o celular" : "de frente para o celular");
  return partes.join(" · ");
}

export function descreverScore(b: Bloco): string {
  return `Score: ${ROTULO_SCORE[b.score]}`;
}

/** Variáveis em etiquetas curtas (PSE, cadência, ADM, ação, densidade). */
export function etiquetasDoBloco(b: Bloco): { rotulo: string; valor: string }[] {
  const lista: { rotulo: string; valor: string }[] = [];
  if (b.pse_alvo) lista.push({ rotulo: "PSE", valor: `${b.pse_alvo}/10` });
  if (b.cadencia) lista.push({ rotulo: "Cadência", valor: b.cadencia });
  if (b.adm) lista.push({ rotulo: "ADM", valor: b.adm });
  if (b.acao) lista.push({ rotulo: "Ação", valor: ROTULO_ACAO[b.acao] });
  const d = densidade(b);
  if (d) lista.push({ rotulo: "Densidade", valor: d });
  return lista;
}

/** Explica a cadência em palavras, ex.: "2-0-1-0" → "desça em 2 s e suba em 1 s". */
export function explicarCadencia(cadencia: string): string {
  const [exc, baixo, con, cima] = cadencia.split("-").map(Number);
  const partes = [`desça em ${exc} s`];
  if (baixo) partes.push(`pare ${baixo} s embaixo`);
  partes.push(`suba em ${con} s`);
  if (cima) partes.push(`pare ${cima} s em cima`);
  return partes.join(", ");
}

// ===================================================================== validação

const SCORES_POR_METODO: Record<MetodoBloco, Score[]> = {
  amrap: ["total_reps", "reps_por_serie"],
  isometria: ["tempo_valido"],
  reps: ["reps_por_serie", "total_reps"],
  emom: ["reps_por_serie"],
  tabata: ["total_reps", "reps_por_serie"],
  for_time: ["tempo_total"],
};

/** Confere a estrutura. Devolve a lista de problemas (vazia quando está tudo certo). */
export function validarEstrutura(e: Estrutura, exercicios: ExercicioMetodo[]): string[] {
  const p: string[] = [];
  const entre = (v: number | undefined, a: number, b: number, nome: string) => {
    if (v === undefined || !Number.isFinite(v) || v < a || v > b) p.push(`${nome} fora de ${a} a ${b}`);
  };
  if (e.versao !== 2) p.push("versão desconhecida");
  if (e.blocos.length === 0) p.push("desafio sem blocos");
  if (e.blocos.length !== exercicios.length) p.push("é preciso um exercício por bloco");
  entre(e.pausa_entre_blocos_s, 0, 120, "pausa_entre_blocos_s");
  if (e.teto_s !== undefined) entre(e.teto_s, 30, 300, "teto_s");
  e.blocos.forEach((b, i) => {
    const r = `bloco ${i + 1}`;
    const ex = exercicios[i];
    entre(b.series, 1, 12, `${r}: series`);
    entre(b.pausa_s, 0, 120, `${r}: pausa_s`);
    if (!SCORES_POR_METODO[b.metodo]?.includes(b.score)) p.push(`${r}: score ${b.score} não combina com ${b.metodo}`);
    if (b.pse_alvo !== undefined) entre(b.pse_alvo, 1, 10, `${r}: pse_alvo`);
    if (b.cadencia !== undefined && !/^\d-\d-\d-\d$/.test(b.cadencia)) p.push(`${r}: cadência deve ser no formato 2-0-1-0`);
    const porTempo = b.metodo === "amrap" || b.metodo === "isometria" || b.metodo === "tabata";
    if (porTempo) entre(b.esforco_s, 5, 300, `${r}: esforco_s`);
    else {
      const metas = Array.isArray(b.reps_alvo) ? b.reps_alvo : [b.reps_alvo];
      if (metas.some((m) => m === undefined || !(m >= 1 && m <= 60))) p.push(`${r}: reps_alvo fora de 1 a 60`);
      if (Array.isArray(b.reps_alvo) && b.reps_alvo.length !== b.series) p.push(`${r}: a escada precisa de uma meta por série`);
    }
    if (b.faixa && !(b.faixa.min >= 1 && b.faixa.max >= b.faixa.min)) p.push(`${r}: faixa inválida`);
    if (b.faixa && b.metodo !== "amrap") p.push(`${r}: faixa só vale no AMRAP`);
    if (b.metodo === "emom" && b.pausa_s !== 0) p.push(`${r}: EMOM não tem pausa (o descanso é o resto do minuto)`);
    if (b.metodo === "for_time" && e.teto_s === undefined) p.push(`${r}: contra o relógio precisa de teto_s`);
    if (ex) {
      if (b.metodo === "isometria" && !ex.sustentacao) p.push(`${r}: ${ex.nome} não é de sustentação`);
      if (b.metodo !== "isometria" && ex.sustentacao) p.push(`${r}: ${ex.nome} é de sustentação: use isometria`);
    }
  });
  return p;
}

// ===================================================================== compilação

export interface OpcoesCompilar {
  /** Segundos da contagem do pop-up "PREPARE-SE" (5 a 10). */
  preparoS?: number;
}

/** Monta a sequência de fases da estrutura. */
export function compilar(e: Estrutura, exercicios: ExercicioMetodo[], opcoes: OpcoesCompilar = {}): LinhaDoTempo {
  const preparoMs = Math.min(10, Math.max(5, opcoes.preparoS ?? PREPARO_PADRAO_S)) * 1000;
  const nome = (i: number) => exercicios[i]?.nome ?? "";

  // Ordem dos esforços: (bloco, série).
  const ordem: { b: number; s: number; rodada: number }[] = [];
  if (e.organizacao === "sequencia") {
    e.blocos.forEach((bl, b) => {
      for (let s = 0; s < bl.series; s++) ordem.push({ b, s, rodada: b });
    });
  } else {
    const rodadas = Math.max(...e.blocos.map((bl) => bl.series));
    for (let r = 0; r < rodadas; r++) e.blocos.forEach((bl, b) => r < bl.series && ordem.push({ b, s: r, rodada: r }));
  }
  const totalTabata = ordem.filter((o) => e.blocos[o.b].metodo === "tabata").length;
  const totalEmom = ordem.filter((o) => e.blocos[o.b].metodo === "emom").length;
  const totalForTime = ordem.filter((o) => e.blocos[o.b].metodo === "for_time" || (e.teto_s && e.blocos[o.b].metodo === "isometria")).length;

  const fases: Fase[] = [];
  const vistos = new Set<number>();
  let contTabata = 0;
  let contEmom = 0;
  let contForTime = 0;

  ordem.forEach((o, k) => {
    const bl = e.blocos[o.b];
    const primeira = !vistos.has(o.b);
    vistos.add(o.b);

    // Antes do esforço: pop-up de preparo na primeira série do bloco (absorve a pausa anterior),
    // ou transição de 3 s quando o exercício muda sem pausa.
    const anterior = fases[fases.length - 1];
    if (primeira) {
      let ms = preparoMs;
      if (anterior?.tipo === "descanso") ms = Math.max(ms, (fases.pop() as { duracaoMs: number }).duracaoMs);
      fases.push({ tipo: "preparo", exercicio: o.b, duracaoMs: ms });
    } else if (anterior?.tipo === "trabalho" && anterior.exercicio !== o.b) {
      fases.push({ tipo: "transicao", exercicio: o.b, duracaoMs: TRANSICAO_MS });
    }

    let rotulo: string;
    if (bl.metodo === "tabata") rotulo = `Round ${++contTabata} de ${totalTabata}`;
    else if (bl.metodo === "emom") rotulo = `Minuto ${++contEmom} de ${totalEmom}`;
    else if (e.teto_s && (bl.metodo === "for_time" || bl.metodo === "isometria")) rotulo = `Tarefa ${++contForTime} de ${totalForTime}`;
    else if (ehEscada(bl)) rotulo = `Degrau ${o.s + 1} de ${bl.series} · ${repsDaSerie(bl, o.s)} reps`;
    else rotulo = `${ordinal(o.s + 1)} série de ${bl.series}${bl.reps_alvo !== undefined ? ` · ${repsDaSerie(bl, o.s)} reps` : ""}`;

    const trabalho: FaseTrabalho = {
      tipo: "trabalho",
      exercicio: o.b,
      serie: o.s + 1,
      totalSeries: bl.series,
      metodo: bl.metodo,
      rotulo,
      sustentar: bl.metodo === "isometria",
    };
    if (bl.metodo === "amrap" || bl.metodo === "isometria" || bl.metodo === "tabata") trabalho.duracaoMs = (bl.esforco_s ?? 30) * 1000;
    else if (bl.metodo === "emom") Object.assign(trabalho, { duracaoMs: 60_000, alvoReps: repsDaSerie(bl, o.s), emom: true });
    else trabalho.alvoReps = repsDaSerie(bl, o.s);
    if (bl.faixa) trabalho.faixa = bl.faixa;
    fases.push(trabalho);

    // Depois do esforço: a pausa certa para o que vem a seguir.
    const prox = ordem[k + 1];
    if (!prox) return;
    let pausa: number;
    if (e.organizacao === "sequencia") pausa = prox.b === o.b ? bl.pausa_s : e.pausa_entre_blocos_s;
    else pausa = prox.rodada !== o.rodada ? Math.max(bl.pausa_s, e.pausa_entre_blocos_s) : bl.pausa_s;
    if (pausa > 0) {
      const pb = e.blocos[prox.b];
      const rot = pb.metodo === "tabata" ? `Round ${contTabata + 1} · ${nome(prox.b)}` : `${ordinal(prox.s + 1)} série · ${nome(prox.b)}${pb.reps_alvo !== undefined ? ` · ${repsDaSerie(pb, prox.s)} reps` : ""}`;
      fases.push({ tipo: "descanso", duracaoMs: pausa * 1000, proximo: prox.b, rotuloProximo: rot });
    }
  });

  const tetoMs = e.teto_s !== undefined ? e.teto_s * 1000 : undefined;
  return { estrutura: e, fases, tetoMs, duracaoEstimadaS: estimar(fases, exercicios, tetoMs) };
}

/**
 * Duração planejada: Σ(séries × esforço + pausas) + pausas entre blocos, com o
 * esforço das séries por repetição estimado pelo ritmo de referência. A
 * contagem inicial não entra; as trocas de exercício entram.
 */
function estimar(fases: Fase[], exercicios: ExercicioMetodo[], tetoMs?: number): number {
  let ms = 0;
  fases.forEach((f, i) => {
    if (f.tipo === "trabalho") ms += f.duracaoMs ?? (f.alvoReps ?? 0) * (exercicios[f.exercicio]?.segPorRep ?? 3) * 1000;
    else if (!(f.tipo === "preparo" && i === 0)) ms += f.duracaoMs;
  });
  if (tetoMs !== undefined) ms = Math.min(ms, tetoMs);
  return Math.round(ms / 1000);
}

/** Segundos de esforço planejados por bloco (para a validação de números no servidor). */
export function segundosPorBloco(linha: LinhaDoTempo, exercicios: ExercicioMetodo[]): number[] {
  const total = linha.estrutura.blocos.map(() => 0);
  for (const f of linha.fases) {
    if (f.tipo !== "trabalho") continue;
    total[f.exercicio] += f.duracaoMs !== undefined ? f.duracaoMs / 1000 : (f.alvoReps ?? 0) * (exercicios[f.exercicio]?.segPorRep ?? 3);
  }
  return total.map((s) => Math.max(10, Math.ceil(s)));
}

// ===================================================================== formato antigo

/** Método do desafio inteiro, usado até a migração 0009 (coluna `metodo`). */
export type Item = { reps: number } | { segundos: number };
export type MetodoAntigo =
  | { tipo: "intervalado"; trabalho_s: number; descanso_s: number; series: number; meta: { tipo: "amrap" } | { tipo: "sustentar" } | { tipo: "faixa"; por_exercicio: { min: number; max: number }[] } }
  | { tipo: "tabata"; rounds: number; trabalho_s: number; descanso_s: number }
  | { tipo: "series"; series: number; reps: number; descanso_s: number }
  | { tipo: "circuito"; rodadas: number; descanso_s: number; itens: Item[] }
  | { tipo: "emom"; minutos: number; reps: number }
  | { tipo: "escada"; degraus: number[]; teto_s: number }
  | { tipo: "contra_relogio"; itens: Item[]; teto_s: number };

/** Quantas vezes o exercício i aparece quando `total` séries se alternam entre `n` exercícios. */
const fatia = (total: number, n: number, i: number) => Math.floor(total / n) + (i < total % n ? 1 : 0);

/** Converte o formato antigo (método do desafio inteiro) para blocos, sem mudar o treino. */
export function converterMetodoAntigo(m: MetodoAntigo, ids: string[], ex: ExercicioMetodo[]): Estrutura {
  const n = ids.length;
  const base = (i: number) => ({ exercicio_id: ids[i], pausa_s: 0 });
  const porTempo = (i: number, s: number, series: number, pausa: number): Bloco =>
    ex[i]?.sustentacao
      ? { ...base(i), metodo: "isometria", series, esforco_s: s, pausa_s: pausa, score: "tempo_valido" }
      : { ...base(i), metodo: "amrap", series, esforco_s: s, pausa_s: pausa, score: "total_reps" };
  switch (m.tipo) {
    case "intervalado":
      return {
        versao: 2, organizacao: "alternada", pausa_entre_blocos_s: 0,
        blocos: ids.map((_, i) => {
          const b = porTempo(i, m.trabalho_s, fatia(m.series, n, i), m.descanso_s);
          if (m.meta.tipo === "faixa" && b.metodo === "amrap") b.faixa = m.meta.por_exercicio[i];
          return b;
        }),
      };
    case "tabata":
      return {
        versao: 2, organizacao: "alternada", pausa_entre_blocos_s: 0,
        blocos: ids.map((_, i) => ({ ...base(i), metodo: "tabata", series: fatia(m.rounds, n, i), esforco_s: m.trabalho_s, pausa_s: m.descanso_s, score: "total_reps" })),
      };
    case "series":
      return {
        versao: 2, organizacao: "sequencia", pausa_entre_blocos_s: m.descanso_s,
        blocos: ids.map((_, i) => ({ ...base(i), metodo: "reps", series: m.series, reps_alvo: m.reps, pausa_s: m.descanso_s, score: "reps_por_serie" })),
      };
    case "circuito":
      return {
        versao: 2, organizacao: "alternada", pausa_entre_blocos_s: m.descanso_s,
        blocos: m.itens.map((it, i) => ("reps" in it
          ? { ...base(i), metodo: "reps", series: m.rodadas, reps_alvo: it.reps, score: "reps_por_serie" }
          : porTempo(i, it.segundos, m.rodadas, 0))),
      };
    case "emom":
      return {
        versao: 2, organizacao: "alternada", pausa_entre_blocos_s: 0,
        blocos: ids.map((_, i) => ({ ...base(i), metodo: "emom", series: fatia(m.minutos, n, i), reps_alvo: m.reps, score: "reps_por_serie" })),
      };
    case "escada":
      return {
        versao: 2, organizacao: "sequencia", pausa_entre_blocos_s: 0, teto_s: m.teto_s,
        blocos: [{ ...base(0), metodo: "reps", series: m.degraus.length, reps_alvo: m.degraus, score: "total_reps" }],
      };
    case "contra_relogio":
      return {
        versao: 2, organizacao: "sequencia", pausa_entre_blocos_s: 0, teto_s: m.teto_s,
        blocos: m.itens.map((it, i) => ("reps" in it
          ? { ...base(i), metodo: "for_time", series: 1, reps_alvo: it.reps, score: "tempo_total" }
          : { ...base(i), metodo: "isometria", series: 1, esforco_s: it.segundos, score: "tempo_valido" })),
      };
  }
}

/** Sem método nenhum no banco (antes da migração 0008): um bloco por exercício com o tempo dele. */
export function estruturaLegada(ids: string[], segundos: number[], ex: ExercicioMetodo[]): Estrutura {
  return converterMetodoAntigo({ tipo: "circuito", rodadas: 1, descanso_s: 0, itens: ids.map((_, i) => ({ segundos: segundos[i] ?? 60 })) }, ids, ex);
}

// ===================================================================== sessão

/** Resultado de uma série (fase de trabalho). Só números. */
export interface ResultadoFase {
  fase: number;
  exercicio: number;
  reps: number;
  parciais: number;
  tempoValidoMs: number;
  duracaoMs: number;
  /** Bateu a meta da série (reps, faixa, EMOM no minuto, sustentou 80% do tempo). */
  cumprida: boolean;
  /** A série foi interrompida antes do fim (Pular, Encerrar ou teto). */
  interrompida: boolean;
}

/** O que a tela informa a cada quadro. */
export interface EntradaSessao {
  reps: number;
  parciais: number;
  tempoValidoMs: number;
  /** Pessoa fora do quadro: o tempo de esforço para. */
  foraDoQuadro: boolean;
  /** Pausa da tela (ex.: "Senti dor"): tudo para. */
  pausado: boolean;
}

export type EventoSessao =
  | { tipo: "fase"; indice: number; fase: Fase }
  | { tipo: "resultado"; resultado: ResultadoFase }
  | { tipo: "emom_cumprido" }
  | { tipo: "contagem"; segundos: number }
  | { tipo: "fim"; motivo: "concluido" | "encerrado" | "teto" };

/**
 * Percorre a linha do tempo. Recebe o relógio e os números da câmera (ou os
 * toques do modo sem câmera) e decide quando cada fase começa e termina.
 */
export class SessaoTreino {
  indice = 0;
  /** Tempo decorrido na fase atual (sem as pausas). */
  decorridoMs = 0;
  emomCumprido = false;
  terminou = false;
  /** Tempo de esforço desde o primeiro esforço (para o teto). */
  totalMs = 0;
  readonly resultados: ResultadoFase[] = [];
  private tAnterior: number | null = null;
  private ultimaEntrada: EntradaSessao = { reps: 0, parciais: 0, tempoValidoMs: 0, foraDoQuadro: false, pausado: false };
  private ultimoSegundo = -1;

  constructor(readonly linha: LinhaDoTempo) {}

  get fase(): Fase {
    return this.linha.fases[this.indice];
  }

  /** Tempo que falta na fase atual (fases por tempo), em ms. */
  get restanteMs(): number | null {
    const f = this.fase;
    if (f.tipo === "trabalho" && f.duracaoMs === undefined) return null;
    return Math.max(0, (f.duracaoMs ?? 0) - this.decorridoMs);
  }

  get restanteTetoMs(): number | null {
    return this.linha.tetoMs === undefined ? null : Math.max(0, this.linha.tetoMs - this.totalMs);
  }

  /** Fração da fase já feita (0 a 1), para a barra. */
  get progresso(): number {
    const f = this.fase;
    if (f.tipo === "trabalho" && f.duracaoMs === undefined) return f.alvoReps ? Math.min(1, this.ultimaEntrada.reps / f.alvoReps) : 0;
    return Math.min(1, this.decorridoMs / (f.duracaoMs ?? 1));
  }

  tick(t: number, entrada: EntradaSessao): EventoSessao[] {
    const eventos: EventoSessao[] = [];
    if (this.terminou) return eventos;
    const dt = this.tAnterior === null ? 0 : Math.max(0, Math.min(500, t - this.tAnterior));
    this.tAnterior = t;
    this.ultimaEntrada = entrada;
    if (entrada.pausado) return eventos;

    const f = this.fase;
    if (f.tipo !== "trabalho") {
      this.decorridoMs += dt;
      this.contar(eventos);
      if (this.decorridoMs >= f.duracaoMs) this.avancar(eventos);
      return eventos;
    }
    // Fora do quadro, o relógio da série para (seção 3.5).
    if (!entrada.foraDoQuadro) {
      this.decorridoMs += dt;
      this.totalMs += dt;
    }
    if (f.emom && !this.emomCumprido && f.alvoReps !== undefined && entrada.reps >= f.alvoReps) {
      this.emomCumprido = true;
      eventos.push({ tipo: "emom_cumprido" });
    }
    if (this.linha.tetoMs !== undefined && this.totalMs >= this.linha.tetoMs) {
      this.registrar(eventos, true);
      this.fim(eventos, "teto");
      return eventos;
    }
    if (f.duracaoMs !== undefined) {
      this.contar(eventos);
      if (this.decorridoMs >= f.duracaoMs) this.avancar(eventos);
    } else if (f.alvoReps !== undefined && entrada.reps >= f.alvoReps) {
      this.avancar(eventos);
    }
    return eventos;
  }

  /** "Pular" (ou "Ok, let's hive" no preparo): fecha a fase atual, contando o que foi feito, e segue. */
  pular(): EventoSessao[] {
    const eventos: EventoSessao[] = [];
    if (this.terminou) return eventos;
    if (this.fase.tipo === "trabalho") this.registrar(eventos, true);
    this.irPara(this.indice + 1, eventos);
    return eventos;
  }

  /** "Encerrar": fecha a fase atual e termina o desafio com o que foi feito. */
  encerrar(): EventoSessao[] {
    const eventos: EventoSessao[] = [];
    if (this.terminou) return eventos;
    if (this.fase.tipo === "trabalho") this.registrar(eventos, true);
    this.fim(eventos, "encerrado");
    return eventos;
  }

  private contar(eventos: EventoSessao[]) {
    const restante = this.restanteMs;
    if (restante === null) return;
    const s = Math.ceil(restante / 1000);
    if (s !== this.ultimoSegundo) {
      this.ultimoSegundo = s;
      if (s > 0 && s <= 3) eventos.push({ tipo: "contagem", segundos: s });
    }
  }

  private avancar(eventos: EventoSessao[]) {
    if (this.fase.tipo === "trabalho") this.registrar(eventos, false);
    this.irPara(this.indice + 1, eventos);
  }

  private irPara(indice: number, eventos: EventoSessao[]) {
    if (indice >= this.linha.fases.length) {
      this.fim(eventos, "concluido");
      return;
    }
    this.indice = indice;
    this.decorridoMs = 0;
    this.emomCumprido = false;
    this.ultimoSegundo = -1;
    this.ultimaEntrada = { ...this.ultimaEntrada, reps: 0, parciais: 0, tempoValidoMs: 0 };
    eventos.push({ tipo: "fase", indice, fase: this.fase });
  }

  private registrar(eventos: EventoSessao[], interrompida: boolean) {
    const f = this.fase;
    if (f.tipo !== "trabalho") return;
    const e = this.ultimaEntrada;
    let cumprida: boolean;
    if (f.sustentar) cumprida = f.duracaoMs !== undefined && e.tempoValidoMs >= 0.8 * f.duracaoMs;
    else if (f.alvoReps !== undefined) cumprida = e.reps >= f.alvoReps;
    else if (f.faixa) cumprida = e.reps >= f.faixa.min;
    else cumprida = e.reps > 0;
    const resultado: ResultadoFase = {
      fase: this.indice,
      exercicio: f.exercicio,
      reps: e.reps,
      parciais: e.parciais,
      tempoValidoMs: Math.round(e.tempoValidoMs),
      duracaoMs: Math.round(this.decorridoMs),
      cumprida,
      interrompida,
    };
    this.resultados.push(resultado);
    eventos.push({ tipo: "resultado", resultado });
  }

  private fim(eventos: EventoSessao[], motivo: "concluido" | "encerrado" | "teto") {
    this.terminou = true;
    eventos.push({ tipo: "fim", motivo });
  }
}

// ===================================================================== resumo

export interface ResumoMetodo {
  /** Linha principal do resultado, ex.: "96 repetições · 60 s em posição". */
  titulo: string;
  detalhes: string[];
}

/** Uma linha do resumo por série. */
export interface LinhaSerie {
  exercicio: number;
  rotulo: string;
  valor: string;
  meta: string | null;
  cumprida: boolean;
}

export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Resultado do desafio: resumo geral, uma linha por série e os números enviados ao servidor. */
export function resumir(linha: LinhaDoTempo, resultados: ResultadoFase[]): { resumo: ResumoMetodo; porSerie: LinhaSerie[]; numeros: Record<string, number> } {
  const e = linha.estrutura;
  const trabalhos = linha.fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");
  const reps = resultados.reduce((s, r) => s + r.reps, 0);
  const tempoValido = Math.round(resultados.reduce((s, r) => s + r.tempoValidoMs, 0) / 1000);
  const cumpridas = resultados.filter((r) => r.cumprida).length;
  const numeros: Record<string, number> = { series_total: trabalhos.length, series_feitas: resultados.length, series_cumpridas: cumpridas, reps_total: reps };

  const porSerie: LinhaSerie[] = resultados.map((r) => {
    const f = linha.fases[r.fase] as FaseTrabalho;
    let valor: string;
    let meta: string | null = null;
    if (f.sustentar) {
      valor = `${Math.round(r.tempoValidoMs / 1000)} s em posição`;
      meta = `${Math.round((f.duracaoMs ?? 0) / 1000)} s`;
    } else if (f.metodo === "for_time") {
      valor = `${r.reps} reps em ${formatarTempo(r.duracaoMs / 1000)}`;
      meta = `${f.alvoReps} reps`;
    } else {
      valor = `${r.reps} ${r.reps === 1 ? "rep" : "reps"}`;
      if (f.alvoReps !== undefined) meta = `${f.alvoReps} reps${f.emom ? " no minuto" : ""}`;
      else if (f.faixa) meta = `${f.faixa.min} a ${f.faixa.max} reps`;
    }
    return { exercicio: r.exercicio, rotulo: f.rotulo, valor, meta, cumprida: r.cumprida };
  });

  const detalhes: string[] = [`${cumpridas} de ${trabalhos.length} séries cumpridas`];
  let titulo: string;
  const temTeto = e.teto_s !== undefined;
  if (temTeto) {
    const tempo = resultados.reduce((s, r) => s + r.duracaoMs, 0) / 1000;
    numeros.tempo_total_s = Math.round(tempo);
    titulo = cumpridas === trabalhos.length ? `Tudo feito em ${formatarTempo(tempo)}` : `${cumpridas} de ${trabalhos.length} etapas dentro do teto`;
  } else {
    const partes: string[] = [];
    if (reps > 0 || e.blocos.some((b) => b.metodo !== "isometria")) partes.push(`${reps} repetições`);
    if (e.blocos.some((b) => b.metodo === "isometria")) partes.push(`${tempoValido} s em posição`);
    titulo = partes.join(" · ");
  }
  numeros.tempo_valido_s = tempoValido;

  const tabata = resultados.filter((r) => (linha.fases[r.fase] as FaseTrabalho).metodo === "tabata");
  if (tabata.length > 0) {
    numeros.pior_round = Math.min(...tabata.map((r) => r.reps));
    detalhes.push(`Pior round do Tabata: ${numeros.pior_round} reps`);
  }
  const emom = resultados.filter((r) => (linha.fases[r.fase] as FaseTrabalho).emom);
  if (emom.length > 0) {
    numeros.minutos_cumpridos = emom.filter((r) => r.cumprida).length;
    detalhes.push(`EMOM: ${numeros.minutos_cumpridos} de ${trabalhos.filter((f) => f.emom).length} minutos cumpridos`);
  }
  // Fadiga no AMRAP: queda entre a primeira e a última série do mesmo bloco (seção 8.3).
  e.blocos.forEach((b, i) => {
    if (b.metodo !== "amrap" && b.metodo !== "tabata") return;
    const series = resultados.filter((r) => r.exercicio === i);
    if (series.length < 2 || series[0].reps === 0) return;
    const queda = Math.round((100 * (series[0].reps - series[series.length - 1].reps)) / series[0].reps);
    numeros[`fadiga_pct_${i + 1}`] = queda;
    if (queda > 0) detalhes.push(`Queda de ${queda}% entre a primeira e a última série`);
  });

  return { resumo: { titulo, detalhes }, porSerie, numeros };
}

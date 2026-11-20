import { describe, expect, it } from "vitest";
import {
  compilar, converterMetodoAntigo, densidade, descreverBloco, descreverScore, etiquetasDoBloco, explicarCadencia,
  resumir, SessaoTreino, validarEstrutura,
  type Bloco, type EntradaSessao, type Estrutura, type EventoSessao, type ExercicioMetodo, type FaseTrabalho, type MetodoAntigo,
} from "../metodos";

const AGACHAMENTO: ExercicioMetodo = { nome: "Agachamento", sustentacao: false, segPorRep: 3 };
const POLICHINELO: ExercicioMetodo = { nome: "Polichinelo", sustentacao: false, segPorRep: 1.5 };
const PRANCHA: ExercicioMetodo = { nome: "Prancha", sustentacao: true, segPorRep: 0, lateral: true };
const MOUNTAIN: ExercicioMetodo = { nome: "Mountain climber", sustentacao: false, segPorRep: 0.7, lateral: true };

const est = (blocos: Bloco[], extra: Partial<Estrutura> = {}): Estrutura => ({ versao: 2, organizacao: "sequencia", pausa_entre_blocos_s: 20, blocos, ...extra });
const amrap = (id: string, series: number, esforco: number, pausa: number): Bloco => ({ exercicio_id: id, metodo: "amrap", series, esforco_s: esforco, pausa_s: pausa, score: "total_reps" });
const iso = (id: string, series: number, esforco: number, pausa: number): Bloco => ({ exercicio_id: id, metodo: "isometria", series, esforco_s: esforco, pausa_s: pausa, score: "tempo_valido" });
const trabalhos = (e: Estrutura, ex: ExercicioMetodo[]) => compilar(e, ex).fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");
const tipos = (e: Estrutura, ex: ExercicioMetodo[]) => compilar(e, ex).fases.map((f) => f.tipo);

/** n6u1d07 do pedido do Luan: prancha ISOMETRIA 3×30 s + mountain climber AMRAP 3×30 s, pausas de 20 s. */
const CORE = est([iso("prancha", 3, 30, 20), amrap("mountain_climber", 3, 30, 20)]);
/** n1u1d03 na versão AMRAP do pedido: agachamento 5×40 s, pausa 20 s. */
const PERNAS_AMRAP = est([amrap("agachamento_livre", 5, 40, 20)]);

describe("duração calculada e densidade", () => {
  it("duracaoTotal = Σ(séries × esforço + (séries − 1) × pausa) + pausas entre blocos", () => {
    expect(compilar(PERNAS_AMRAP, [AGACHAMENTO]).duracaoEstimadaS).toBe(5 * 40 + 4 * 20);
    expect(compilar(CORE, [PRANCHA, MOUNTAIN]).duracaoEstimadaS).toBe((3 * 30 + 2 * 20) * 2 + 20);
  });

  it("densidade = esforço:pausa simplificado", () => {
    expect(densidade(amrap("x", 5, 40, 20))).toBe("2:1");
    expect(densidade({ exercicio_id: "x", metodo: "tabata", series: 8, esforco_s: 20, pausa_s: 10, score: "total_reps" })).toBe("2:1");
    expect(densidade(amrap("x", 3, 30, 30))).toBe("1:1");
    expect(densidade({ exercicio_id: "x", metodo: "reps", series: 3, reps_alvo: 8, pausa_s: 60, score: "reps_por_serie" })).toBeNull();
  });
});

describe("textos do card", () => {
  it("formato pedido: método · séries × esforço · pausa · de frente ou de lado", () => {
    expect(descreverBloco(PERNAS_AMRAP.blocos[0], AGACHAMENTO)).toBe("AMRAP · 5 × 40 s · pausa 20 s · de frente para o celular");
    expect(descreverBloco(CORE.blocos[0], PRANCHA)).toBe("Isometria · 3 × 30 s · pausa 20 s · de lado para o celular");
    expect(descreverScore(PERNAS_AMRAP.blocos[0])).toBe("Conta como: total de repetições");
    expect(descreverScore(CORE.blocos[0])).toBe("Conta como: segundos em posição");
  });

  it("repetições, escada, EMOM e contra o relógio", () => {
    expect(descreverBloco({ exercicio_id: "x", metodo: "reps", series: 3, reps_alvo: 8, pausa_s: 60, score: "reps_por_serie" })).toBe("Repetições · 3 × 8 reps · pausa 60 s");
    expect(descreverBloco({ exercicio_id: "x", metodo: "reps", series: 4, reps_alvo: [2, 4, 6, 8], pausa_s: 0, score: "total_reps" })).toBe("Escada · 2-4-6-8 reps · sem pausa");
    expect(descreverBloco({ exercicio_id: "x", metodo: "emom", series: 4, reps_alvo: 10, pausa_s: 0, score: "reps_por_serie" })).toBe("EMOM · 4 × 10 reps por minuto");
    expect(descreverBloco({ exercicio_id: "x", metodo: "for_time", series: 1, reps_alvo: 15, pausa_s: 0, score: "tempo_total" })).toBe("Contra o relógio · 15 reps");
  });

  it("variáveis em etiquetas e cadência explicada", () => {
    const b: Bloco = { exercicio_id: "x", metodo: "amrap", series: 3, esforco_s: 40, pausa_s: 20, score: "total_reps", pse_alvo: 7, cadencia: "2-0-1-0", adm: "completa", acao: "mista" };
    expect(etiquetasDoBloco(b)).toEqual([
      { rotulo: "PSE", valor: "7/10" }, { rotulo: "Cadência", valor: "2-0-1-0" }, { rotulo: "ADM", valor: "completa" },
      { rotulo: "Ação", valor: "mista" }, { rotulo: "Densidade", valor: "2:1" },
    ]);
    expect(explicarCadencia("2-0-1-0")).toBe("desça em 2 s, suba em 1 s");
    expect(explicarCadencia("3-1-1-0")).toBe("desça em 3 s, pare 1 s embaixo, suba em 1 s");
  });
});

describe("compilação em fases", () => {
  it("sequência: pop-up de preparo antes de cada bloco, pausas entre séries", () => {
    expect(tipos(CORE, [PRANCHA, MOUNTAIN])).toEqual([
      "preparo", "trabalho", "descanso", "trabalho", "descanso", "trabalho",
      "preparo", "trabalho", "descanso", "trabalho", "descanso", "trabalho",
    ]);
    const linha = compilar(CORE, [PRANCHA, MOUNTAIN], { preparoS: 8 });
    // O preparo do segundo bloco absorve a pausa entre blocos (20 s > 8 s).
    expect(linha.fases[0]).toEqual({ tipo: "preparo", exercicio: 0, duracaoMs: 8000 });
    expect(linha.fases[6]).toEqual({ tipo: "preparo", exercicio: 1, duracaoMs: 20_000 });
    const t = trabalhos(CORE, [PRANCHA, MOUNTAIN]);
    expect(t.map((f) => [f.exercicio, f.serie, f.sustentar, f.duracaoMs])).toEqual([
      [0, 1, true, 30_000], [0, 2, true, 30_000], [0, 3, true, 30_000],
      [1, 1, false, 30_000], [1, 2, false, 30_000], [1, 3, false, 30_000],
    ]);
  });

  it("a contagem do preparo vai de 5 a 10 s", () => {
    expect((compilar(PERNAS_AMRAP, [AGACHAMENTO], { preparoS: 3 }).fases[0] as { duracaoMs: number }).duracaoMs).toBe(5000);
    expect((compilar(PERNAS_AMRAP, [AGACHAMENTO], { preparoS: 30 }).fases[0] as { duracaoMs: number }).duracaoMs).toBe(10_000);
  });

  it("alternada (Tabata com 2 exercícios): A, B, A, B… com 10 s entre todos", () => {
    const tabata = est([
      { exercicio_id: "a", metodo: "tabata", series: 4, esforco_s: 20, pausa_s: 10, score: "total_reps" },
      { exercicio_id: "p", metodo: "tabata", series: 4, esforco_s: 20, pausa_s: 10, score: "total_reps" },
    ], { organizacao: "alternada", pausa_entre_blocos_s: 0 });
    const linha = compilar(tabata, [AGACHAMENTO, POLICHINELO]);
    const t = linha.fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");
    expect(t.map((f) => f.exercicio)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(t[4].rotulo).toBe("Round 5 de 8");
    expect(linha.duracaoEstimadaS).toBe(8 * 20 + 7 * 10);
  });

  it("alternada (circuito): sem pausa entre exercícios (3 s de troca) e pausa ao fim da rodada", () => {
    const circuito = est([
      { exercicio_id: "a", metodo: "reps", series: 2, reps_alvo: 10, pausa_s: 0, score: "reps_por_serie" },
      iso("prancha", 2, 30, 0),
    ], { organizacao: "alternada", pausa_entre_blocos_s: 20 });
    expect(tipos(circuito, [AGACHAMENTO, PRANCHA])).toEqual(["preparo", "trabalho", "preparo", "trabalho", "descanso", "trabalho", "transicao", "trabalho"]);
  });

  it("repetições, escada e EMOM", () => {
    const reps = trabalhos(est([{ exercicio_id: "a", metodo: "reps", series: 3, reps_alvo: 8, pausa_s: 60, score: "reps_por_serie" }]), [AGACHAMENTO]);
    expect(reps.map((f) => [f.rotulo, f.alvoReps, f.duracaoMs])).toEqual([["1ª série de 3 · 8 reps", 8, undefined], ["2ª série de 3 · 8 reps", 8, undefined], ["3ª série de 3 · 8 reps", 8, undefined]]);
    const escada = compilar(est([{ exercicio_id: "a", metodo: "reps", series: 4, reps_alvo: [2, 4, 6, 8], pausa_s: 0, score: "total_reps" }], { teto_s: 180 }), [AGACHAMENTO]);
    expect(escada.tetoMs).toBe(180_000);
    expect(escada.fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho").map((f) => f.rotulo)).toEqual([
      "Degrau 1 de 4 · 2 reps", "Degrau 2 de 4 · 4 reps", "Degrau 3 de 4 · 6 reps", "Degrau 4 de 4 · 8 reps",
    ]);
    const emom = trabalhos(est([{ exercicio_id: "a", metodo: "emom", series: 3, reps_alvo: 10, pausa_s: 0, score: "reps_por_serie" }]), [AGACHAMENTO]);
    expect(emom.map((f) => [f.rotulo, f.duracaoMs, f.alvoReps, f.emom])).toEqual([["Minuto 1 de 3", 60_000, 10, true], ["Minuto 2 de 3", 60_000, 10, true], ["Minuto 3 de 3", 60_000, 10, true]]);
  });
});

describe("validação", () => {
  it("aceita os exemplos do pedido", () => {
    expect(validarEstrutura(CORE, [PRANCHA, MOUNTAIN])).toEqual([]);
    expect(validarEstrutura(PERNAS_AMRAP, [AGACHAMENTO])).toEqual([]);
  });

  it("recusa combinações sem sentido", () => {
    const erros = (e: Estrutura, ex: ExercicioMetodo[]) => validarEstrutura(e, ex).join(" | ");
    expect(erros(est([amrap("prancha", 3, 30, 20)]), [PRANCHA])).toContain("use isometria");
    expect(erros(est([iso("agachamento", 3, 30, 20)]), [AGACHAMENTO])).toContain("não é de sustentação");
    expect(erros(est([{ ...amrap("a", 3, 30, 20), score: "tempo_valido" }]), [AGACHAMENTO])).toContain("não combina");
    expect(erros(est([{ ...amrap("a", 3, 30, 20), cadencia: "lento" }]), [AGACHAMENTO])).toContain("cadência");
    expect(erros(est([{ ...amrap("a", 3, 30, 20), pse_alvo: 11 }]), [AGACHAMENTO])).toContain("pse_alvo");
    expect(erros(est([{ exercicio_id: "a", metodo: "for_time", series: 1, reps_alvo: 20, pausa_s: 0, score: "tempo_total" }]), [AGACHAMENTO])).toContain("teto_s");
    expect(erros(est([{ exercicio_id: "a", metodo: "reps", series: 3, reps_alvo: [2, 4], pausa_s: 0, score: "total_reps" }]), [AGACHAMENTO])).toContain("uma meta por série");
    expect(erros(est([amrap("a", 3, 30, 20)]), [AGACHAMENTO, POLICHINELO])).toContain("um exercício por bloco");
  });
});

describe("conversão do formato antigo (sem mudar o treino)", () => {
  const casos: [MetodoAntigo, string[], ExercicioMetodo[]][] = [
    [{ tipo: "intervalado", trabalho_s: 30, descanso_s: 10, series: 6, meta: { tipo: "faixa", por_exercicio: [{ min: 20, max: 30 }, { min: 30, max: 45 }] } }, ["m", "s"], [AGACHAMENTO, POLICHINELO]],
    [{ tipo: "tabata", rounds: 8, trabalho_s: 20, descanso_s: 10 }, ["a", "b", "c"], [AGACHAMENTO, POLICHINELO, AGACHAMENTO]],
    [{ tipo: "series", series: 2, reps: 10, descanso_s: 45 }, ["a", "b"], [AGACHAMENTO, POLICHINELO]],
    [{ tipo: "circuito", rodadas: 3, descanso_s: 20, itens: [{ segundos: 40 }, { reps: 20 }] }, ["p", "m"], [PRANCHA, MOUNTAIN]],
    [{ tipo: "emom", minutos: 4, reps: 10 }, ["a"], [AGACHAMENTO]],
    [{ tipo: "escada", degraus: [2, 4, 6, 8], teto_s: 240 }, ["a"], [AGACHAMENTO]],
    [{ tipo: "contra_relogio", itens: [{ reps: 15 }, { segundos: 30 }], teto_s: 240 }, ["a", "p"], [AGACHAMENTO, PRANCHA]],
  ];
  it.each(casos.map((c) => [c[0].tipo, ...c] as const))("%s", (_t, metodo, ids, ex) => {
    const e = converterMetodoAntigo(metodo, ids, ex);
    expect(validarEstrutura(e, ex)).toEqual([]);
    expect(compilar(e, ex).duracaoEstimadaS).toBeLessThanOrEqual(300);
  });

  it("Tabata de 3 exercícios continua com 8 rounds alternados", () => {
    const e = converterMetodoAntigo({ tipo: "tabata", rounds: 8, trabalho_s: 20, descanso_s: 10 }, ["a", "b", "c"], [AGACHAMENTO, POLICHINELO, AGACHAMENTO]);
    expect(trabalhos(e, [AGACHAMENTO, POLICHINELO, AGACHAMENTO]).map((f) => f.exercicio)).toEqual([0, 1, 2, 0, 1, 2, 0, 1]);
  });
});

/** Roda uma sessão com quadros de 100 ms, usando `entrada(t, sessao)` para os números. */
function simular(sessao: SessaoTreino, entrada: (t: number, s: SessaoTreino) => Partial<EntradaSessao>, limiteMs = 900_000) {
  const eventos: EventoSessao[] = [];
  for (let t = 0; t <= limiteMs && !sessao.terminou; t += 100) {
    eventos.push(...sessao.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, foraDoQuadro: false, pausado: false, ...entrada(t, sessao) }));
  }
  return eventos;
}

describe("sessão de treino", () => {
  it("o pop-up de preparo conta e o 'Ok, let's hive' (pular) começa na hora", () => {
    const s = new SessaoTreino(compilar(PERNAS_AMRAP, [AGACHAMENTO], { preparoS: 10 }));
    const eventos: EventoSessao[] = [];
    for (let t = 0; t <= 7000; t += 100) eventos.push(...s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, foraDoQuadro: false, pausado: false }));
    expect(s.fase.tipo).toBe("preparo");
    expect(eventos.filter((e) => e.tipo === "contagem").map((e) => (e as { segundos: number }).segundos)).toEqual([3]);
    s.pular();
    expect(s.fase).toMatchObject({ tipo: "trabalho", serie: 1 });
    expect(s.resultados).toHaveLength(0);
  });

  it("n1u1d03 em AMRAP: 5 séries, total de reps e resumo por série", () => {
    const linha = compilar(PERNAS_AMRAP, [AGACHAMENTO], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    // Fadiga: 1 rep a cada 2,5 s na 1ª série, cada vez mais devagar. (A última leitura da série
    // acontece um quadro antes do fim, por isso 15 e não 16 na primeira.)
    simular(s, (_t, x) => ({ reps: x.fase.tipo === "trabalho" ? Math.floor(x.decorridoMs / (2500 + 400 * x.resultados.length)) : 0 }));
    expect(s.resultados.map((r) => r.reps)).toEqual([15, 13, 12, 10, 9]);
    const { resumo, porSerie, numeros } = resumir(linha, s.resultados);
    expect(resumo.titulo).toBe("59 repetições");
    expect(resumo.detalhes).toContain("Queda de 40% entre a primeira e a última série");
    expect(porSerie[1]).toEqual({ exercicio: 0, rotulo: "2ª série de 5", valor: "13 reps", meta: null, cumprida: true });
    expect(numeros).toMatchObject({ reps_total: 59, series_total: 5, series_cumpridas: 5, fadiga_pct_1: 40 });
  });

  it("n6u1d07: tempo válido da prancha e reps do mountain climber", () => {
    const linha = compilar(CORE, [PRANCHA, MOUNTAIN], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    simular(s, (_t, x) => {
      const f = x.fase;
      if (f.tipo !== "trabalho") return {};
      return f.sustentar ? { tempoValidoMs: x.decorridoMs * 0.9 } : { reps: Math.floor(x.decorridoMs / 1000) };
    });
    const { resumo, porSerie } = resumir(linha, s.resultados);
    expect(resumo.titulo).toBe("87 repetições · 81 s em posição");
    expect(porSerie[0]).toMatchObject({ rotulo: "1ª série de 3", valor: "27 s em posição", meta: "30 s", cumprida: true });
    expect(porSerie[3]).toMatchObject({ valor: "29 reps", cumprida: true });
  });

  it("séries de repetições esperam a pessoa (sem teto)", () => {
    const linha = compilar(est([{ exercicio_id: "a", metodo: "reps", series: 2, reps_alvo: 10, pausa_s: 30, score: "reps_por_serie" }]), [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    simular(s, (_t, x) => ({ reps: x.fase.tipo === "trabalho" ? Math.floor(x.decorridoMs / 6000) : 0 }));
    expect(s.resultados.map((r) => [r.reps, r.cumprida, r.interrompida])).toEqual([[10, true, false], [10, true, false]]);
    expect(s.resultados[0].duracaoMs).toBeGreaterThanOrEqual(60_000);
  });

  it("EMOM: minuto cumprido vira descanso; resumo conta os minutos", () => {
    const linha = compilar(est([{ exercicio_id: "a", metodo: "emom", series: 3, reps_alvo: 10, pausa_s: 0, score: "reps_por_serie" }]), [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    const eventos = simular(s, (_t, x) => {
      if (x.fase.tipo !== "trabalho") return {};
      const lento = x.resultados.length === 1;
      return { reps: Math.min(lento ? 6 : 10, Math.floor(x.decorridoMs / (lento ? 10_000 : 3000))) };
    });
    expect(eventos.filter((e) => e.tipo === "emom_cumprido")).toHaveLength(2);
    expect(resumir(linha, s.resultados).resumo.detalhes).toContain("EMOM: 2 de 3 minutos cumpridos");
  });

  it("escada com teto: encerra no meio de um degrau", () => {
    const linha = compilar(est([{ exercicio_id: "a", metodo: "reps", series: 5, reps_alvo: [2, 4, 6, 8, 10], pausa_s: 0, score: "total_reps" }], { teto_s: 60 }), [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    const eventos = simular(s, (_t, x) => ({ reps: x.fase.tipo === "trabalho" ? Math.floor(x.decorridoMs / 3000) : 0 }));
    expect(eventos.at(-1)).toEqual({ tipo: "fim", motivo: "teto" });
    expect(s.resultados.map((r) => r.cumprida)).toEqual([true, true, true, false]);
    expect(resumir(linha, s.resultados).resumo.titulo).toBe("3 de 5 etapas dentro do teto");
  });

  it("Tabata: pior round no resumo", () => {
    const linha = compilar(est([{ exercicio_id: "a", metodo: "tabata", series: 8, esforco_s: 20, pausa_s: 10, score: "total_reps" }]), [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    simular(s, (_t, x) => ({ reps: x.fase.tipo === "trabalho" ? Math.floor(x.decorridoMs / (x.resultados.length === 5 ? 2500 : 1500)) : 0 }));
    const { numeros, resumo } = resumir(linha, s.resultados);
    expect(numeros.pior_round).toBe(7);
    expect(resumo.detalhes).toContain("Pior round do Tabata: 7 reps");
  });

  it("fora do quadro o relógio do esforço para; Pular e Encerrar registram o que foi feito", () => {
    const linha = compilar(est([amrap("a", 2, 10, 10)]), [AGACHAMENTO], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    simular(s, (t, x) => ({ foraDoQuadro: x.fase.tipo === "trabalho" && x.resultados.length === 0 && x.decorridoMs >= 5000 && t < 14_000 }));
    expect(s.resultados[0].duracaoMs).toBeGreaterThanOrEqual(10_000);

    const s2 = new SessaoTreino(compilar(est([{ exercicio_id: "a", metodo: "reps", series: 3, reps_alvo: 10, pausa_s: 30, score: "reps_por_serie" }]), [AGACHAMENTO]));
    s2.pular();
    s2.tick(100, { reps: 4, parciais: 1, tempoValidoMs: 0, foraDoQuadro: false, pausado: false });
    expect(s2.pular()[0]).toMatchObject({ tipo: "resultado", resultado: { reps: 4, parciais: 1, cumprida: false, interrompida: true } });
    expect(s2.fase.tipo).toBe("descanso");
    expect(s2.encerrar().at(-1)).toEqual({ tipo: "fim", motivo: "encerrado" });
  });

  it("pausa (Senti dor) congela tudo", () => {
    const s = new SessaoTreino(compilar(PERNAS_AMRAP, [AGACHAMENTO]));
    simular(s, () => ({}), 3000);
    const antes = s.decorridoMs;
    for (let t = 3100; t < 30_000; t += 100) s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, foraDoQuadro: false, pausado: true });
    expect(s.decorridoMs).toBe(antes);
  });
});

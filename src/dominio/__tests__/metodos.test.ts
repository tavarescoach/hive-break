import { describe, expect, it } from "vitest";
import {
  montarLinhaDoTempo, resumirMetodo, SessaoTreino, validarMetodo,
  type EntradaSessao, type EventoSessao, type ExercicioMetodo, type FaseTrabalho, type Metodo,
} from "../metodos";

const AGACHAMENTO: ExercicioMetodo = { nome: "Agachamento", sustentacao: false, segPorRep: 3 };
const POLICHINELO: ExercicioMetodo = { nome: "Polichinelo", sustentacao: false, segPorRep: 1.5 };
const PRANCHA: ExercicioMetodo = { nome: "Prancha", sustentacao: true, segPorRep: 0 };

const trabalhos = (m: Metodo, ex: ExercicioMetodo[]) =>
  montarLinhaDoTempo(m, ex).fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");
const tipos = (m: Metodo, ex: ExercicioMetodo[]) => montarLinhaDoTempo(m, ex).fases.map((f) => f.tipo);

describe("linha do tempo dos métodos", () => {
  it("Tabata: 8 rounds de 20/10 = 4 min, exercícios alternados", () => {
    const m: Metodo = { tipo: "tabata", rounds: 8, trabalho_s: 20, descanso_s: 10 };
    const linha = montarLinhaDoTempo(m, [AGACHAMENTO, POLICHINELO]);
    expect(linha.duracaoEstimadaS).toBe(8 * 20 + 7 * 10);
    const t = trabalhos(m, [AGACHAMENTO, POLICHINELO]);
    expect(t.map((f) => f.exercicio)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(t[4].rotulo).toBe("Round 5 de 8");
    expect(t.every((f) => f.duracaoMs === 20_000 && !f.alvoReps)).toBe(true);
  });

  it("intervalado: séries por tempo com meta de faixa por exercício", () => {
    const m: Metodo = { tipo: "intervalado", trabalho_s: 30, descanso_s: 20, series: 3, meta: { tipo: "faixa", por_exercicio: [{ min: 10, max: 14 }] } };
    const t = trabalhos(m, [AGACHAMENTO]);
    expect(t.map((f) => [f.rotulo, f.faixa])).toEqual([
      ["1ª série de 3", { min: 10, max: 14 }], ["2ª série de 3", { min: 10, max: 14 }], ["3ª série de 3", { min: 10, max: 14 }],
    ]);
    expect(tipos(m, [AGACHAMENTO])).toEqual(["preparo", "trabalho", "descanso", "trabalho", "descanso", "trabalho"]);
  });

  it("intervalado de sustentação: a fase mede tempo na posição", () => {
    const m: Metodo = { tipo: "intervalado", trabalho_s: 30, descanso_s: 15, series: 3, meta: { tipo: "sustentar" } };
    expect(trabalhos(m, [PRANCHA]).every((f) => f.sustentar)).toBe(true);
  });

  it("séries e repetições: cada exercício faz suas séries; a fase termina nas reps", () => {
    const m: Metodo = { tipo: "series", series: 3, reps: 10, descanso_s: 45 };
    const linha = montarLinhaDoTempo(m, [AGACHAMENTO, POLICHINELO]);
    const t = linha.fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");
    expect(t.map((f) => `${f.exercicio}:${f.rotulo}`)).toEqual([
      "0:1ª série de 3", "0:2ª série de 3", "0:3ª série de 3", "1:1ª série de 3", "1:2ª série de 3", "1:3ª série de 3",
    ]);
    expect(t.every((f) => f.alvoReps === 10 && f.duracaoMs === undefined)).toBe(true);
    const descansos = linha.fases.filter((f) => f.tipo === "descanso");
    expect(descansos).toHaveLength(5);
    expect(descansos[2]).toMatchObject({ proximo: 1, rotuloProximo: "1ª série · Polichinelo · 10 reps" });
    // 30 reps × 3 s + 30 reps × 1,5 s + 5 × 45 s
    expect(linha.duracaoEstimadaS).toBe(90 + 45 + 225);
  });

  it("circuito: sem pausa entre exercícios (transição de 3 s), descanso entre rodadas", () => {
    const m: Metodo = { tipo: "circuito", rodadas: 2, descanso_s: 20, itens: [{ reps: 10 }, { segundos: 30 }] };
    expect(tipos(m, [AGACHAMENTO, PRANCHA])).toEqual(["preparo", "trabalho", "transicao", "trabalho", "descanso", "trabalho", "transicao", "trabalho"]);
    const t = trabalhos(m, [AGACHAMENTO, PRANCHA]);
    expect(t[1]).toMatchObject({ sustentar: true, duracaoMs: 30_000, rotulo: "Rodada 1 de 2 · 30 s" });
  });

  it("EMOM: um minuto por fase, com alvo de reps", () => {
    const t = trabalhos({ tipo: "emom", minutos: 4, reps: 12 }, [AGACHAMENTO, POLICHINELO]);
    expect(t.map((f) => [f.exercicio, f.duracaoMs, f.alvoReps, f.emom])).toEqual([
      [0, 60_000, 12, true], [1, 60_000, 12, true], [0, 60_000, 12, true], [1, 60_000, 12, true],
    ]);
  });

  it("escada e contra o relógio têm teto de tempo", () => {
    const escada = montarLinhaDoTempo({ tipo: "escada", degraus: [2, 4, 6, 8, 10], teto_s: 180 }, [AGACHAMENTO]);
    expect(escada.tetoMs).toBe(180_000);
    expect(escada.fases.filter((f) => f.tipo === "trabalho").map((f) => (f as FaseTrabalho).alvoReps)).toEqual([2, 4, 6, 8, 10]);
    expect(escada.duracaoEstimadaS).toBe(90);
    const contra = montarLinhaDoTempo({ tipo: "contra_relogio", itens: [{ reps: 100 }, { segundos: 30 }], teto_s: 240 }, [AGACHAMENTO, PRANCHA]);
    expect(contra.duracaoEstimadaS).toBe(240);
  });
});

describe("validação dos métodos", () => {
  it("aceita métodos corretos", () => {
    expect(validarMetodo({ tipo: "tabata", rounds: 8, trabalho_s: 20, descanso_s: 10 }, [AGACHAMENTO])).toEqual([]);
    expect(validarMetodo({ tipo: "circuito", rodadas: 2, descanso_s: 20, itens: [{ reps: 10 }, { segundos: 30 }] }, [AGACHAMENTO, PRANCHA])).toEqual([]);
  });

  it("recusa combinações sem sentido", () => {
    expect(validarMetodo({ tipo: "tabata", rounds: 8, trabalho_s: 20, descanso_s: 10 }, [PRANCHA]).join()).toContain("sustentação");
    expect(validarMetodo({ tipo: "series", series: 3, reps: 10, descanso_s: 45 }, [PRANCHA]).join()).toContain("sustentação");
    expect(validarMetodo({ tipo: "circuito", rodadas: 2, descanso_s: 20, itens: [{ reps: 10 }] }, [PRANCHA]).join()).toContain("segundos");
    expect(validarMetodo({ tipo: "escada", degraus: [2, 4], teto_s: 120 }, [AGACHAMENTO, POLICHINELO]).join()).toContain("um exercício");
    expect(validarMetodo({ tipo: "series", series: 9, reps: 10, descanso_s: 45 }, [AGACHAMENTO]).join()).toContain("series");
    expect(validarMetodo({ tipo: "intervalado", trabalho_s: 30, descanso_s: 10, series: 2, meta: { tipo: "sustentar" } }, [AGACHAMENTO]).join()).toContain("sustentar");
  });
});

/** Roda uma sessão com quadros de 100 ms, usando `entrada(t, sessao)` para os números. */
function simular(sessao: SessaoTreino, entrada: (t: number, s: SessaoTreino) => Partial<EntradaSessao>, limiteMs = 600_000) {
  const eventos: EventoSessao[] = [];
  for (let t = 0; t <= limiteMs && !sessao.terminou; t += 100) {
    eventos.push(...sessao.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, pronto: true, foraDoQuadro: false, pausado: false, ...entrada(t, sessao) }));
  }
  return eventos;
}

describe("sessão de treino", () => {
  it("preparo espera o corpo aparecer e conta 3 s antes do primeiro trabalho", () => {
    const s = new SessaoTreino(montarLinhaDoTempo({ tipo: "tabata", rounds: 2, trabalho_s: 20, descanso_s: 10 }, [AGACHAMENTO]));
    for (let t = 0; t < 5000; t += 100) s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, pronto: false, foraDoQuadro: false, pausado: false });
    expect(s.fase.tipo).toBe("preparo");
    const eventos: EventoSessao[] = [];
    for (let t = 5000; t < 8200; t += 100) eventos.push(...s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, pronto: true, foraDoQuadro: false, pausado: false }));
    expect(eventos.filter((e) => e.tipo === "contagem").map((e) => (e as { segundos: number }).segundos)).toEqual([3, 2, 1]);
    expect(s.fase.tipo).toBe("trabalho");
  });

  it("Tabata completo: 8 rounds, soma e pior round", () => {
    const linha = montarLinhaDoTempo({ tipo: "tabata", rounds: 8, trabalho_s: 20, descanso_s: 10 }, [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    // Reps crescem com o tempo da fase; o round 6 é mais fraco.
    const eventos = simular(s, (_t, x) => ({ reps: x.fase.tipo === "trabalho" ? Math.floor(x.decorridoMs / (x.resultados.length === 5 ? 2500 : 1500)) : 0 }));
    expect(eventos.at(-1)).toEqual({ tipo: "fim", motivo: "concluido" });
    expect(s.resultados).toHaveLength(8);
    const { resumo, numeros } = resumirMetodo(linha, s.resultados);
    expect(numeros.pior_round).toBe(7);
    expect(resumo.detalhes[0]).toBe("Pior round: 7 reps");
    expect(numeros.reps_total).toBe(7 * 13 + 7);
  });

  it("séries e repetições: a série espera a pessoa completar as reps (sem teto)", () => {
    const linha = montarLinhaDoTempo({ tipo: "series", series: 2, reps: 10, descanso_s: 30 }, [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    // A pessoa faz 1 rep a cada 6 s: a primeira série leva ~60 s, bem mais que o planejado.
    simular(s, (_t, x) => ({ reps: x.fase.tipo === "trabalho" ? Math.floor(x.decorridoMs / 6000) : 0 }));
    expect(s.resultados.map((r) => [r.reps, r.cumprida, r.interrompida])).toEqual([[10, true, false], [10, true, false]]);
    expect(s.resultados[0].duracaoMs).toBeGreaterThanOrEqual(60_000);
  });

  it("fora do quadro: o relógio do trabalho para; o do descanso não", () => {
    const s = new SessaoTreino(montarLinhaDoTempo({ tipo: "intervalado", trabalho_s: 10, descanso_s: 10, series: 2, meta: { tipo: "amrap" } }, [AGACHAMENTO]));
    // Some entre 5 s e 9 s do primeiro trabalho.
    simular(s, (_t, x) => ({ foraDoQuadro: x.fase.tipo === "trabalho" && x.resultados.length === 0 && x.decorridoMs >= 5000 && _t < 12_500 }));
    expect(s.resultados[0].duracaoMs).toBeGreaterThanOrEqual(10_000);
    expect(s.terminou).toBe(true);
  });

  it("EMOM: cumpre o minuto quando bate o alvo; o resto do minuto é descanso", () => {
    const linha = montarLinhaDoTempo({ tipo: "emom", minutos: 3, reps: 10 }, [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    let cumpridos = 0;
    // Minutos 1 e 3: 10 reps em 30 s. Minuto 2: só 6 reps.
    const eventos = simular(s, (_t, x) => {
      if (x.fase.tipo !== "trabalho") return {};
      const ritmo = x.resultados.length === 1 ? 10_000 : 3000;
      return { reps: Math.min(x.resultados.length === 1 ? 6 : 10, Math.floor(x.decorridoMs / ritmo)) };
    });
    cumpridos = eventos.filter((e) => e.tipo === "emom_cumprido").length;
    expect(cumpridos).toBe(2);
    expect(s.resultados.map((r) => r.cumprida)).toEqual([true, false, true]);
    expect(s.resultados.every((r) => r.duracaoMs >= 59_900)).toBe(true);
    expect(resumirMetodo(linha, s.resultados).resumo.titulo).toBe("2 de 3 minutos cumpridos");
  });

  it("escada: o teto encerra o desafio no meio de um degrau", () => {
    const linha = montarLinhaDoTempo({ tipo: "escada", degraus: [2, 4, 6, 8, 10], teto_s: 60 }, [AGACHAMENTO]);
    const s = new SessaoTreino(linha);
    const eventos = simular(s, (_t, x) => ({ reps: x.fase.tipo === "trabalho" ? Math.floor(x.decorridoMs / 3000) : 0 }));
    expect(eventos.at(-1)).toEqual({ tipo: "fim", motivo: "teto" });
    // 2+4+6 reps a 3 s = 36 s; o degrau de 8 não fecha até 60 s.
    expect(s.resultados.map((r) => r.cumprida)).toEqual([true, true, true, false]);
    expect(resumirMetodo(linha, s.resultados).resumo.titulo).toBe("3 de 5 degraus");
  });

  it("Pular fecha a fase atual e Encerrar termina com o que foi feito", () => {
    const s = new SessaoTreino(montarLinhaDoTempo({ tipo: "series", series: 3, reps: 10, descanso_s: 30 }, [AGACHAMENTO, POLICHINELO]));
    simular(s, () => ({}), 4000);
    expect(s.fase).toMatchObject({ tipo: "trabalho", exercicio: 0 });
    s.tick(4100, { reps: 4, parciais: 1, tempoValidoMs: 0, pronto: true, foraDoQuadro: false, pausado: false });
    const pulo = s.pular();
    expect(pulo[0]).toMatchObject({ tipo: "resultado", resultado: { reps: 4, parciais: 1, cumprida: false, interrompida: true } });
    expect(s.fase.tipo).toBe("descanso");
    s.pular();
    expect(s.fase).toMatchObject({ tipo: "trabalho", rotulo: "2ª série de 3" });
    const fim = s.encerrar();
    expect(fim.at(-1)).toEqual({ tipo: "fim", motivo: "encerrado" });
    expect(s.resultados).toHaveLength(2);
  });

  it("sustentação: cumpre com 80% do tempo na posição", () => {
    const linha = montarLinhaDoTempo({ tipo: "intervalado", trabalho_s: 30, descanso_s: 10, series: 2, meta: { tipo: "sustentar" } }, [PRANCHA]);
    const s = new SessaoTreino(linha);
    simular(s, (_t, x) => ({ tempoValidoMs: x.fase.tipo === "trabalho" ? x.decorridoMs * (x.resultados.length === 0 ? 0.9 : 0.5) : 0 }));
    expect(s.resultados.map((r) => r.cumprida)).toEqual([true, false]);
    expect(resumirMetodo(linha, s.resultados).resumo.detalhes).toEqual(["1 de 2 séries sustentadas"]);
  });

  it("pausa (Senti dor) congela tudo", () => {
    const s = new SessaoTreino(montarLinhaDoTempo({ tipo: "tabata", rounds: 2, trabalho_s: 20, descanso_s: 10 }, [AGACHAMENTO]));
    simular(s, () => ({}), 5000);
    const antes = s.decorridoMs;
    for (let t = 5100; t < 30_000; t += 100) s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, pronto: true, foraDoQuadro: false, pausado: true });
    expect(s.decorridoMs).toBe(antes);
  });
});

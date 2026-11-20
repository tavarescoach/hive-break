/**
 * Etapa 1C-B: os 13 exercícios novos do Modo Escritório (docs/TRILHA_ESC_V2.md §6.3).
 * A respiração (ESC-14) usa `respiracao_guiada`, que já existia. Limiares [validar]
 * no dia de calibração; aqui se testa a lógica: conta o movimento completo, recusa o
 * incompleto e acende os avisos.
 */
import { describe, expect, it } from "vitest";
import { definicao, dosTipo, rodar } from "./apoio";
import { ambos, rad, roteiro, soma, type Pose, type XY } from "./poses2d";

/** Ponto C tal que o ângulo A–B–C vale `graus` (gira o vetor B→A), a `l` de B. */
function comAngulo(a: XY, b: XY, graus: number, l: number): XY {
  const ang = Math.atan2(a[1] - b[1], a[0] - b[0]) + rad(graus);
  return [b[0] + l * Math.cos(ang), b[1] + l * Math.sin(ang)];
}

// Sentado, de frente, meio corpo: largura dos ombros = 0,2.
const OMBRO_Y = 0.5;
const meioCorpo = (extra: Pose = {}): Pose => ({
  ombro_e: [0.6, OMBRO_Y], ombro_d: [0.4, OMBRO_Y],
  orelha_e: [0.54, 0.4], orelha_d: [0.46, 0.4], nariz: [0.5, 0.42],
  cotovelo_e: [0.62, 0.68], cotovelo_d: [0.38, 0.68], punho_e: [0.62, 0.85], punho_d: [0.38, 0.85],
  ...extra,
});

const poses: Record<string, (v: number) => Pose> = {
  // De lado: orelha à frente do ombro, em braços (ombro→cotovelo = 0,2).
  retracao_queixo: (v) => ambos({ ombro: [0.5, 0.5], cotovelo: [0.5, 0.7], orelha: [0.5 + v * 0.2, 0.38] }),
  inclinacao_pescoco: (v) => meioCorpo({
    orelha_e: [0.5 + 0.04 * Math.cos(rad(v)), 0.4 + 0.04 * Math.sin(rad(v))],
    orelha_d: [0.5 - 0.04 * Math.cos(rad(v)), 0.4 - 0.04 * Math.sin(rad(v))],
  }),
  rotacao_pescoco: (v) => meioCorpo({ nariz: [0.5 + v * 0.2, 0.42] }),
  encolher_ombros: (v) => meioCorpo({ orelha_e: [0.54, OMBRO_Y - v * 0.2], orelha_d: [0.46, OMBRO_Y - v * 0.2] }),
  anjo: (v) => meioCorpo({
    cotovelo_e: [0.74, OMBRO_Y], cotovelo_d: [0.26, OMBRO_Y],
    punho_e: [0.74, OMBRO_Y - v * 0.2], punho_d: [0.26, OMBRO_Y - v * 0.2],
  }),
  elevacao_lateral: (v) => meioCorpo({
    cotovelo_e: [0.75, OMBRO_Y - v * 0.2], cotovelo_d: [0.25, OMBRO_Y - v * 0.2],
    punho_e: [0.85, OMBRO_Y - v * 0.2], punho_d: [0.15, OMBRO_Y - v * 0.2],
  }),
  // Largura dos ombros ÷ (meio dos ombros → nariz = 0,1).
  rotacao_tronco_sentado: (v) => meioCorpo({ ombro_e: [0.5 + v * 0.05, OMBRO_Y], ombro_d: [0.5 - v * 0.05, OMBRO_Y], nariz: [0.5, OMBRO_Y - 0.1] }),
  remada: (v) => {
    const ombro: XY = [0.5, 0.4];
    const cotovelo: XY = [0.62, 0.48];
    return ambos({ ombro, cotovelo, punho: comAngulo(ombro, cotovelo, v, 0.15), quadril: [0.5, 0.7] });
  },
  // Tronco: deslocamento do ombro em relação ao quadril (positivo = para a frente, onde o nariz aponta).
  extensao_coluna_em_pe: (v) => ({ ...ambos({ quadril: [0.5, 0.6], ombro: [0.5 + v * 0.3, 0.3] }), nariz: [0.55 + v * 0.3, 0.25] }),
  panturrilha_em_pe: (v) => ambos({ joelho: [0.5, 0.7], tornozelo: [0.5, 0.85], ponta_pe: [0.55, 0.9], calcanhar: [0.47, 0.9 - v * 0.15] }),
  flexao_inclinada_mesa: (v) => {
    const ombro: XY = [0.4, 0.45];
    const cotovelo: XY = [0.42, 0.58];
    return ambos({ ombro, cotovelo, punho: comAngulo(ombro, cotovelo, v, 0.13), quadril: [0.6, 0.6], tornozelo: [0.8, 0.75] });
  },
};

describe("1C-B · exercícios de repetição", () => {
  const casos: { id: string; inicio: number; fim: number; incompleto: number }[] = [
    { id: "retracao_queixo", inicio: 0.25, fim: 0.05, incompleto: 0.15 },
    { id: "inclinacao_pescoco", inicio: 0, fim: 25, incompleto: 12 },
    { id: "rotacao_pescoco", inicio: 0, fim: 0.4, incompleto: 0.2 },
    { id: "encolher_ombros", inicio: 0.5, fim: 0.3, incompleto: 0.4 },
    { id: "anjo", inicio: 0.9, fim: 1.8, incompleto: 1.4 },
    { id: "elevacao_lateral", inicio: -0.9, fim: 0, incompleto: -0.4 },
    { id: "rotacao_tronco_sentado", inicio: 2, fim: 1.3, incompleto: 1.6 },
    { id: "remada", inicio: 170, fim: 80, incompleto: 120 },
    { id: "extensao_coluna_em_pe", inicio: 0, fim: -0.15, incompleto: -0.04 },
    { id: "panturrilha_em_pe", inicio: 0, fim: 0.25, incompleto: 0.08 },
    { id: "flexao_inclinada_mesa", inicio: 170, fim: 90, incompleto: 120 },
  ];

  for (const c of casos) {
    const def = definicao(c.id);
    const uma = (alvo: number): [number, number][] => [[c.inicio, 0.6], [alvo, 1], [alvo, 0.3], [c.inicio, 1], [c.inicio, 0.6]];

    it(`${c.id}: conta o movimento completo, duas vezes quando repete`, () => {
      expect(rodar(def, roteiro(poses[c.id], uma(c.fim))).estado.repsValidas).toBe(1);
      expect(rodar(def, roteiro(poses[c.id], [...uma(c.fim), ...uma(c.fim)])).estado.repsValidas).toBe(2);
    });

    it(`${c.id}: não conta o movimento incompleto`, () => {
      expect(rodar(def, roteiro(poses[c.id], uma(c.incompleto))).estado.repsValidas).toBe(0);
    });
  }

  it("extensao_coluna_em_pe: inclinar para a frente não conta como extensão", () => {
    expect(rodar(definicao("extensao_coluna_em_pe"), roteiro(poses.extensao_coluna_em_pe, [[0, 0.6], [0.15, 1], [0.15, 0.3], [0, 1]])).estado.repsValidas).toBe(0);
  });

  it("inclinacao_pescoco: ombros que inclinam junto acendem o aviso", () => {
    const torto = (v: number) => ({ ...poses.inclinacao_pescoco(v), ombro_e: [0.6, OMBRO_Y + 0.03] as XY, ombro_d: [0.4, OMBRO_Y - 0.03] as XY });
    const { eventos } = rodar(definicao("inclinacao_pescoco"), roteiro(torto, [[0, 0.6], [25, 1], [25, 0.3], [0, 1]]));
    expect(dosTipo(eventos, "erro").some((e) => e.id === "ombro_sobe")).toBe(true);
  });

  it("anjo: cotovelos abaixo da linha dos ombros acendem o aviso", () => {
    const caido = (v: number) => ({ ...poses.anjo(v), cotovelo_e: [0.74, OMBRO_Y + 0.06] as XY, cotovelo_d: [0.26, OMBRO_Y + 0.06] as XY });
    const { eventos } = rodar(definicao("anjo"), roteiro(caido, [[0.9, 0.6], [1.8, 1], [1.8, 0.3], [0.9, 1]]));
    expect(dosTipo(eventos, "erro").some((e) => e.id === "cotovelos_caem")).toBe(true);
  });

  it("elevacao_lateral: punhos acima do ombro acendem o aviso", () => {
    const alto = (v: number) => ({ ...poses.elevacao_lateral(v), punho_e: [0.85, OMBRO_Y - 0.1] as XY, punho_d: [0.15, OMBRO_Y - 0.1] as XY });
    const { eventos } = rodar(definicao("elevacao_lateral"), roteiro(alto, [[-0.9, 0.6], [0, 1], [0, 0.6], [-0.9, 1]]));
    expect(dosTipo(eventos, "erro").some((e) => e.id === "acima_do_ombro")).toBe(true);
  });

  it("flexao_inclinada_mesa: quadril caído anula a repetição", () => {
    const caido = (v: number) => ({ ...poses.flexao_inclinada_mesa(v), quadril_e: [0.6, 0.68] as XY, quadril_d: [0.6, 0.68] as XY });
    const { estado } = rodar(definicao("flexao_inclinada_mesa"), roteiro(caido, [[170, 0.6], [90, 1], [90, 0.3], [170, 1], [170, 0.6]]));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(1);
  });
});

describe("1C-B · tempo e guiado", () => {
  it("flexor_quadril_em_pe: corre com joelho da frente dobrado, perna de trás esticada e tronco em pé", () => {
    const quadril: XY = [0.5, 0.5];
    const joelhoFrente: XY = [0.62, 0.62];
    const tornozeloFrente = comAngulo(quadril, joelhoFrente, 100, 0.2);
    const joelhoTras: XY = [0.42, 0.65];
    const tornozeloTras = soma(joelhoTras, [joelhoTras[0] - quadril[0], joelhoTras[1] - quadril[1]]);
    const certo: Pose = {
      ombro_e: [0.5, 0.2], ombro_d: [0.5, 0.2], quadril_e: quadril, quadril_d: quadril,
      joelho_e: joelhoFrente, tornozelo_e: tornozeloFrente, joelho_d: joelhoTras, tornozelo_d: tornozeloTras,
    };
    const def = definicao("flexor_quadril_em_pe");
    expect(rodar(def, roteiro(() => certo, [[0, 5]])).estado.tempoValidoMs).toBeGreaterThan(4000);
    const inclinado: Pose = { ...certo, ombro_e: [0.65, 0.25], ombro_d: [0.65, 0.25] };
    expect(rodar(def, roteiro(() => inclinado, [[0, 5]])).estado.tempoValidoMs).toBe(0);
  });

  it("mobilidade_punho (guiado): o tempo corre com a pessoa na frente da câmera", () => {
    const def = definicao("mobilidade_punho");
    expect(rodar(def, roteiro(() => meioCorpo(), [[0, 5]])).estado.tempoValidoMs).toBeGreaterThan(4000);
  });
});

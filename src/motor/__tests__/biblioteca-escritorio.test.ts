/**
 * Etapa 1C-A: os 11 exercícios da biblioteca (ABS e GLU) que o Modo Escritório
 * usa (docs/TRILHA_ESC_V2.md §6.2). As poses são montadas ponto a ponto em 2D
 * (o boneco de `sintetico.ts` só fica de frente e em pé): cada exercício tem uma
 * função que posiciona os pontos a partir do valor que a regra mede.
 * Os limiares seguem [validar] até o dia de calibração (Etapa C).
 */
import { describe, expect, it } from "vitest";
import { definicao, dosTipo, rodar } from "./apoio";
import { ambos, dir, rad, roteiro, soma, type Pose, type XY } from "./poses2d";

// ------------------------------------------------------------ poses de lado

/** Ângulo do quadril (ombro–quadril–joelho) em `graus`, em pé, de lado. */
function quadrilLateral(graus: number, opcoes: { joelhoLivre?: number; peLivreAlto?: number } = {}): Pose {
  const quadril: XY = [0.5, 0.55];
  const joelho = soma(quadril, dir(0, 0.2));
  const tornozelo = soma(joelho, dir(0, 0.2));
  const ombro = soma(quadril, dir(graus, 0.3));
  const pose = ambos({ quadril, joelho, tornozelo, ombro, cotovelo: ombro, punho: ombro });
  if (opcoes.joelhoLivre !== undefined) {
    // Perna livre (direita) estendida atrás, em linha com o tronco.
    const kd = soma(quadril, dir(graus + opcoes.joelhoLivre, 0.2));
    pose.joelho_d = kd;
    pose.tornozelo_d = soma(kd, dir(graus + opcoes.joelhoLivre, 0.2));
  }
  if (opcoes.peLivreAlto !== undefined) pose.tornozelo_d = [pose.tornozelo_d[0], pose.tornozelo_e[1] - opcoes.peLivreAlto];
  return pose;
}

/** Ângulo do joelho (quadril–joelho–tornozelo) em `graus`, de lado. */
function joelhoLateral(graus: number, peLivreAlto?: number): Pose {
  const tornozelo: XY = [0.5, 0.9];
  const joelho = soma(tornozelo, dir(180, 0.2));
  const quadril = soma(joelho, dir(180 - (180 - graus), 0.2).map((v, i) => (i === 0 ? -v : v)) as XY);
  const pose = ambos({ tornozelo, joelho, quadril, ombro: soma(quadril, [0, -0.3]) });
  if (peLivreAlto !== undefined) {
    pose.joelho_d = soma(pose.quadril_d, [0.2, 0]);
    // Perna livre estendida à frente, joelho reto, pé fora do chão.
    pose.tornozelo_d = soma(pose.joelho_d, [0.2, 0]);
    pose.tornozelo_d = [pose.tornozelo_d[0], Math.min(pose.tornozelo_d[1], pose.tornozelo_e[1] - peLivreAlto)];
    pose.joelho_d = [pose.joelho_d[0], pose.tornozelo_d[1]];
    pose.quadril_d = [pose.quadril_d[0], pose.tornozelo_d[1]];
  }
  return pose;
}

/** Prancha inclinada: corpo a `inclinacao` graus da vertical, quadril caído (`linha` < 180). */
function pranchaInclinada(linha: number, inclinacao = 50): Pose {
  const tornozelo: XY = [0.2, 0.85];
  const quadril = soma(tornozelo, dir(180 - inclinacao, 0.35).map((v, i) => (i === 0 ? Math.abs(v) : v)) as XY);
  const sentido = dir(180 - inclinacao + (180 - linha), 0.3);
  const ombro = soma(quadril, [Math.abs(sentido[0]), sentido[1]]);
  return ambos({ tornozelo, quadril, ombro, punho: [ombro[0] + 0.02, ombro[1] + 0.2], cotovelo: ombro });
}

// ------------------------------------------------------------ poses de frente

const FRENTE_BASE = { ombro_e: [0.6, 0.35], ombro_d: [0.4, 0.35], quadril_e: [0.56, 0.6], quadril_d: [0.44, 0.6] } as Record<string, XY>;

function inclinacaoLateral(graus: number, quadrilTorto = 0): Pose {
  const centro: XY = [0.5, 0.35];
  const meia = 0.1;
  return {
    ...FRENTE_BASE,
    ombro_e: [centro[0] + meia * Math.cos(rad(graus)), centro[1] + meia * Math.sin(rad(graus))],
    ombro_d: [centro[0] - meia * Math.cos(rad(graus)), centro[1] - meia * Math.sin(rad(graus))],
    quadril_e: [0.56, 0.6 + quadrilTorto],
    quadril_d: [0.44, 0.6 - quadrilTorto],
  };
}

function abducao(graus: number, troncoInclina = 0): Pose {
  const meio: XY = [0.5, 0.6];
  return {
    ombro_e: [0.6 + troncoInclina, 0.35],
    ombro_d: [0.4 + troncoInclina, 0.35],
    quadril_e: [0.55, 0.6],
    quadril_d: [0.45, 0.6],
    tornozelo_e: soma(meio, dir(-graus / 2, 0.4)).map((v, i) => (i === 0 ? meio[0] - (v - meio[0]) : v)) as XY,
    tornozelo_d: soma(meio, dir(-graus / 2, 0.4)),
  };
}

function pallof(deslocamento: number, bracosRetos = true): Pose {
  const cx = 0.5 + deslocamento;
  return {
    ...FRENTE_BASE,
    cotovelo_e: bracosRetos ? [0.55 + deslocamento / 2, 0.38] : [0.64, 0.5],
    cotovelo_d: bracosRetos ? [0.45 + deslocamento / 2, 0.38] : [0.36, 0.5],
    punho_e: bracosRetos ? [cx + 0.01, 0.41] : [0.55, 0.38],
    punho_d: bracosRetos ? [cx - 0.01, 0.41] : [0.45, 0.38],
  };
}

/** Joelho esquerdo sobe até o cotovelo direito: `perto` de 0 (encostado) a 1 (em pé). */
function cruzado(perto: number, lado: "e" | "d" = "e"): Pose {
  const pose: Pose = {
    ...FRENTE_BASE,
    cotovelo_e: [0.66, 0.3], cotovelo_d: [0.34, 0.3],
    joelho_e: [0.56, 0.8], joelho_d: [0.44, 0.8],
  };
  const cot = lado === "e" ? pose.cotovelo_d : pose.cotovelo_e;
  const base = lado === "e" ? pose.joelho_e : pose.joelho_d;
  const alvo: XY = [cot[0], cot[1] + 0.05];
  pose[`joelho_${lado}`] = [alvo[0] + (base[0] - alvo[0]) * perto, alvo[1] + (base[1] - alvo[1]) * perto];
  return pose;
}

// ------------------------------------------------------------ testes

describe("1C-A · exercícios de repetição (V1)", () => {
  const casos: { id: string; montar: (v: number) => Pose; topo: number; fundo: number; incompleto: number; rapido: number }[] = [
    { id: "stiff_kickstand", montar: (v) => quadrilLateral(v), topo: 175, fundo: 100, incompleto: 135, rapido: 0.3 },
    { id: "stiff_unilateral", montar: (v) => quadrilLateral(v, { joelhoLivre: 180 }), topo: 175, fundo: 100, incompleto: 135, rapido: 0.3 },
    { id: "joelhos_peito_cadeira", montar: (v) => quadrilLateral(v), topo: 105, fundo: 55, incompleto: 80, rapido: 0.3 },
    { id: "sentar_levantar_uma_perna", montar: (v) => joelhoLateral(v, 0.3), topo: 175, fundo: 90, incompleto: 125, rapido: 0.4 },
    { id: "inclinacao_lateral_em_pe", montar: (v) => inclinacaoLateral(v), topo: 0, fundo: 28, incompleto: 15, rapido: 0.3 },
    { id: "abducao_em_pe", montar: (v) => abducao(v), topo: 5, fundo: 40, incompleto: 21, rapido: 0.2 },
  ];

  for (const c of casos) {
    const def = definicao(c.id);
    const rep = (fundo: number, s: number): [number, number][] => [[fundo, s], [c.topo, s]];
    const roteiroDe = (...reps: [number, number][][]) => roteiro(c.montar, [[c.topo, 0.6], ...reps.flat(), [c.topo, 0.6]]);

    it(`${c.id}: conta 1 repetição completa e 2 quando repete`, () => {
      expect(rodar(def, roteiroDe(rep(c.fundo, 1))).estado.repsValidas).toBe(1);
      expect(rodar(def, roteiroDe(rep(c.fundo, 1), rep(c.fundo, 1))).estado.repsValidas).toBe(2);
    });

    it(`${c.id}: não conta a repetição incompleta`, () => {
      expect(rodar(def, roteiroDe(rep(c.incompleto, 1))).estado.repsValidas).toBe(0);
    });

    it(`${c.id}: não conta a repetição rápida demais`, () => {
      expect(rodar(def, roteiroDe(rep(c.fundo, c.rapido / 2))).estado.repsValidas).toBe(0);
    });
  }

  it("stiff_unilateral: perna livre no chão no fundo acende o aviso", () => {
    const def = definicao("stiff_unilateral");
    const frames = roteiro((v) => quadrilLateral(v), [[175, 0.6], [100, 1], [175, 1]]);
    expect(dosTipo(rodar(def, frames).eventos, "erro").some((e) => e.id === "pe_encostou")).toBe(true);
  });

  it("inclinacao_lateral_em_pe: quadril que acompanha o tronco acende o aviso", () => {
    const def = definicao("inclinacao_lateral_em_pe");
    const frames = roteiro((v) => inclinacaoLateral(v, 0.03), [[0, 0.6], [28, 1], [0, 1]]);
    expect(dosTipo(rodar(def, frames).eventos, "erro").some((e) => e.id === "quadril_mexe")).toBe(true);
  });

  it("abducao_em_pe: tronco inclinado acende o aviso", () => {
    const def = definicao("abducao_em_pe");
    const frames = roteiro((v) => abducao(v, 0.12), [[5, 0.6], [40, 1], [5, 1]]);
    expect(dosTipo(rodar(def, frames).eventos, "erro").some((e) => e.id === "tronco_inclina")).toBe(true);
  });

  it("joelho_cotovelo_cruzado: alterna os lados e conta cada toque", () => {
    const def = definicao("joelho_cotovelo_cruzado");
    const frames = [
      // Segura 0,3 s no toque: a fase precisa durar mais que o mínimo (150 ms).
      ...roteiro((v) => cruzado(v, "e"), [[1, 0.5], [0, 0.6], [0, 0.3], [1, 0.6]]),
      ...roteiro((v) => cruzado(v, "d"), [[1, 0.2], [0, 0.6], [0, 0.3], [1, 0.6]], 2100),
      ...roteiro((v) => cruzado(v, "e"), [[1, 0.2], [0, 0.6], [0, 0.3], [1, 0.6]], 3900),
    ];
    expect(rodar(def, frames).estado.repsValidas).toBe(3);
  });

  it("joelho_cotovelo_cruzado: joelho que não chega ao cotovelo não conta", () => {
    const def = definicao("joelho_cotovelo_cruzado");
    const frames = roteiro((v) => cruzado(v, "e"), [[1, 0.5], [0.55, 0.6], [0.55, 0.3], [1, 0.6]]);
    expect(rodar(def, frames).estado.repsValidas).toBe(0);
  });
});

describe("1C-A · exercícios de tempo (V2)", () => {
  const segundos = (ms: number) => Math.round(ms / 100) / 10;

  it("prancha_mesa: corre com o corpo alinhado e para com o quadril caído", () => {
    const def = definicao("prancha_mesa");
    const bom = rodar(def, roteiro((v) => pranchaInclinada(v), [[178, 0.3], [178, 5]]));
    expect(segundos(bom.estado.tempoValidoMs)).toBeGreaterThanOrEqual(4.5);
    const caido = rodar(def, roteiro((v) => pranchaInclinada(v), [[150, 0.3], [150, 5]]));
    expect(caido.estado.tempoValidoMs).toBe(0);
  });

  it("prancha_mesa: corpo quase em pé (encostado na parede) não vale", () => {
    const def = definicao("prancha_mesa");
    const emPe = rodar(def, roteiro((v) => pranchaInclinada(178, v), [[10, 0.3], [10, 5]]));
    expect(emPe.estado.tempoValidoMs).toBe(0);
  });

  it("pallof_em_pe: mãos no centro com braços estendidos vale; mãos puxadas para o lado não", () => {
    const def = definicao("pallof_em_pe");
    const bom = rodar(def, roteiro((v) => pallof(v), [[0, 0.3], [0, 5]]));
    expect(segundos(bom.estado.tempoValidoMs)).toBeGreaterThanOrEqual(4.5);
    const puxado = rodar(def, roteiro((v) => pallof(v), [[0.06, 0.3], [0.06, 5]]));
    expect(puxado.estado.tempoValidoMs).toBe(0);
    const dobrado = rodar(def, roteiro(() => pallof(0, false), [[0, 0.3], [0, 5]]));
    expect(dobrado.estado.tempoValidoMs).toBe(0);
  });

  it("cadeira_parede: só corre com o joelho entre 80° e 110°", () => {
    const def = definicao("cadeira_parede");
    const bom = rodar(def, roteiro((v) => joelhoLateral(v), [[95, 0.3], [95, 5]]));
    expect(segundos(bom.estado.tempoValidoMs)).toBeGreaterThanOrEqual(4.5);
    const alto = rodar(def, roteiro((v) => joelhoLateral(v), [[130, 0.3], [130, 5]]));
    expect(alto.estado.tempoValidoMs).toBe(0);
  });

  it("aviao: tronco perto da horizontal com a perna de trás em linha vale; em pé não", () => {
    const def = definicao("aviao");
    const bom = rodar(def, roteiro((v) => quadrilLateral(v, { joelhoLivre: 180 }), [[100, 0.3], [100, 5]]));
    expect(segundos(bom.estado.tempoValidoMs)).toBeGreaterThanOrEqual(4.5);
    const emPe = rodar(def, roteiro((v) => quadrilLateral(v, { joelhoLivre: 180 }), [[170, 0.3], [170, 5]]));
    expect(emPe.estado.tempoValidoMs).toBe(0);
  });
});

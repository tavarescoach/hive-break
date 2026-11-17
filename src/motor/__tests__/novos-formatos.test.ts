import { describe, expect, it } from "vitest";
import { Motor } from "../motor";
import { INDICE_PONTO, TOTAL_PONTOS } from "../pontos";
import type { EventoMotor, Frame, Ponto } from "../tipos";
import { definicao, dosTipo, rodar } from "./apoio";
import { criarAleatorio, gerarFrame, gerarSequencia, parado, PROPORCAO, repetir, suave, type Trecho } from "./sintetico";

/** Um passo de marcha ou skipping: sobe um joelho, segura e desce. */
function passo(lado: "e" | "d", altura: number, sobe = 0.15, segura = 0.12, desce = 0.15, pausa = 0.05): Trecho[] {
  const pose = (h: number) => (lado === "e" ? { joelhoAltoE: h } : { joelhoAltoD: h });
  return [
    { s: sobe, pose: (u) => pose(altura * suave(u)) },
    { s: segura, pose: () => pose(altura) },
    { s: desce, pose: (u) => pose(altura * (1 - suave(u))) },
    { s: pausa, pose: () => ({}) },
  ];
}
const passos = (n: number, altura: number, ...tempos: number[]) =>
  Array.from({ length: n }, (_, i) => passo(i % 2 === 0 ? "e" : "d", altura, ...tempos)).flat();

describe("exercícios alternados (skipping e marcha)", () => {
  it("skipping: conta cada joelho que chega à altura do quadril e mede a simetria", () => {
    const { estado, kpis } = rodar(definicao("skipping"), gerarSequencia([parado(1), ...passos(20, 1), parado(1)]));
    expect(estado.repsValidas).toBe(20);
    expect(kpis).toMatchObject({ reps_e: 10, reps_d: 10, simetria: 1, reps_parciais: 0 });
    expect(kpis.cadencia).toBeGreaterThan(100);
  });

  it("skipping: joelho abaixo da linha do quadril vira parcial com aviso", () => {
    const { estado, eventos } = rodar(definicao("skipping"), gerarSequencia([parado(1), ...passos(8, 0.72), parado(1)]));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(8);
    expect(dosTipo(eventos, "rep_parcial")[0].feedback).toBe("Joelho mais alto");
  });

  it("marcha: aceita joelho à meia altura, que no skipping não vale", () => {
    const frames = gerarSequencia([parado(1), ...passos(12, 0.62, 0.25, 0.2, 0.25, 0.1), parado(1)]);
    expect(rodar(definicao("marcha_estacionaria"), frames).estado.repsValidas).toBe(12);
    expect(rodar(definicao("skipping"), frames).estado.repsValidas).toBe(0);
  });

  it("parado em pé não conta nada; segurar o joelho no alto conta uma vez só", () => {
    expect(rodar(definicao("marcha_estacionaria"), gerarSequencia([parado(5)], { ruido: 0.008 })).estado).toMatchObject({ repsValidas: 0, repsParciais: 0 });
    const segurando = gerarSequencia([parado(1), ...passo("e", 1, 0.2, 3, 0.2), parado(1)]);
    expect(rodar(definicao("skipping"), segurando).estado.repsValidas).toBe(1);
  });

  it("simetria cai quando um lado trabalha menos", () => {
    const frames = gerarSequencia([parado(1), ...repetir(6, () => [...passo("e", 1), ...passo("e", 1), ...passo("d", 1)]), parado(1)]);
    const { kpis } = rodar(definicao("skipping"), frames);
    expect(kpis).toMatchObject({ reps_e: 12, reps_d: 6, simetria: 0.5 });
  });
});

/** Pose de lado para a câmera: só os pontos dados; o lado de trás fica pouco visível. */
function poseLateral(t: number, pontos: Record<string, [number, number]>, ladoVisivel: "e" | "d" = "d"): Frame {
  const lista: Ponto[] = Array.from({ length: TOTAL_PONTOS }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
  for (const [nome, [x, y]] of Object.entries(pontos)) {
    for (const lado of ["e", "d"] as const) {
      lista[INDICE_PONTO[`${nome}_${lado}`]] = { x, y, z: 0, visibility: lado === ladoVisivel ? 0.95 : 0.2 };
    }
  }
  return { t, pontos: lista, mundo: lista.map((p) => ({ x: p.x, y: p.y, z: 0 })) };
}

/** Bom-dia de lado: quadril fixo, tronco inclina `graus` para a frente. */
function bomDia(t: number, graus: number, joelhoDobrado = 0, lado: "e" | "d" = "d"): Frame {
  const r = (graus * Math.PI) / 180;
  const k = (joelhoDobrado * Math.PI) / 180;
  return poseLateral(t, {
    tornozelo: [0.5, 0.9],
    joelho: [0.5 + 0.2 * Math.sin(k), 0.9 - 0.2 * Math.cos(k)],
    quadril: [0.5, 0.5],
    ombro: [0.5 + 0.25 * Math.sin(r), 0.5 - 0.25 * Math.cos(r)],
  }, lado);
}

function repsBomDia(n: number, fundo: number, joelho = 0, lado: "e" | "d" = "d"): Frame[] {
  const frames: Frame[] = [];
  let t = 0;
  const empurrar = (graus: number) => frames.push(bomDia((t += 33), graus, joelho && graus > 40 ? joelho : 0, lado));
  for (let i = 0; i < 30; i++) empurrar(5);
  for (let rep = 0; rep < n; rep++) {
    for (let i = 0; i <= 25; i++) empurrar(5 + (fundo - 5) * suave(i / 25));
    for (let i = 0; i < 8; i++) empurrar(fundo);
    for (let i = 0; i <= 25; i++) empurrar(fundo - (fundo - 5) * suave(i / 25));
    for (let i = 0; i < 12; i++) empurrar(5);
  }
  return frames;
}

describe("exercícios de lado para a câmera", () => {
  const def = definicao("bom_dia_bastao");
  const rodarLateral = (frames: Frame[]) => {
    const motor = new Motor(def, { proporcao: 1 });
    const eventos: EventoMotor[] = frames.flatMap((f) => motor.processar(f));
    return { motor, eventos };
  };

  it("conta repetições usando o lado visível, seja o esquerdo ou o direito", () => {
    for (const lado of ["e", "d"] as const) {
      const { motor } = rodarLateral(repsBomDia(6, 85, 0, lado));
      expect(motor.estado.repsValidas, `lado ${lado}`).toBe(6);
    }
  });

  it("basta um dos lados visível para o frame valer", () => {
    const { motor, eventos } = rodarLateral(repsBomDia(3, 85));
    expect(motor.estado.frameValido).toBe(true);
    expect(dosTipo(eventos, "fora_quadro")).toHaveLength(0);
    expect(motor.kpis().fora_quadro_pct).toBe(0);
  });

  it("inclinação curta vira parcial; joelho dobrado demais é erro de execução", () => {
    expect(rodarLateral(repsBomDia(4, 55)).motor.estado).toMatchObject({ repsValidas: 0, repsParciais: 4 });
    const comErro = rodarLateral(repsBomDia(4, 85, 45));
    expect(comErro.motor.estado.repsValidas).toBe(4);
    expect(comErro.motor.kpis()).toMatchObject({ indice_tecnico: 0, erros: { joelhos_dobrados: 4 } });
  });

  it("prancha: o tempo só corre com o corpo deitado e alinhado", () => {
    const prancha = definicao("prancha");
    const corpo = (t: number, quadrilY: number) =>
      poseLateral(t, { ombro: [0.25, 0.6], quadril: [0.5, quadrilY], tornozelo: [0.78, 0.66] });
    const frames: Frame[] = [];
    let t = 0;
    for (let i = 0; i < 300; i++) frames.push(corpo((t += 33), 0.63)); // alinhado: ~10 s
    for (let i = 0; i < 150; i++) frames.push(corpo((t += 33), 0.74)); // quadril caído: ~5 s
    const motor = new Motor(prancha, { proporcao: 1 });
    const eventos = frames.flatMap((f) => motor.processar(f));
    const kpis = motor.kpis();
    expect(kpis.tempo_valido_s).toBeGreaterThan(9.4);
    expect(kpis.tempo_valido_s).toBeLessThan(10.2);
    expect(dosTipo(eventos, "posicao_perdida")[0].feedback).toBe("Alinhe o quadril");
    expect(kpis.pct_tempo_valido).toBeGreaterThan(0.6);
    expect(kpis.pct_tempo_valido).toBeLessThan(0.72);

    // Em pé o corpo também fica "alinhado", mas não é prancha.
    const emPe = new Motor(prancha, { proporcao: 1 });
    for (let i = 0; i < 90; i++) emPe.processar(poseLateral(i * 33, { ombro: [0.5, 0.3], quadril: [0.5, 0.55], tornozelo: [0.5, 0.9] }));
    expect(emPe.kpis().tempo_valido_s).toBe(0);
  });
});

describe("toque nos alvos", () => {
  const def = definicao("toque_alvos");

  it("acerta quando o punho entra no círculo e perde o alvo depois de 2 s", () => {
    const motor = new Motor(def, { proporcao: PROPORCAO, aleatorio: criarAleatorio(5), suavizar: false });
    const eventos: EventoMotor[] = [];
    let t = 0;
    const base = gerarFrame(0, { bracos: 20 });
    // Fase 1: a mão vai até cada alvo que aparece (5 alvos).
    while (dosTipo(eventos, "alvo_acerto").length < 5 && t < 60000) {
      t += 33;
      const frame: Frame = { t, pontos: base.pontos!.map((p) => ({ ...p })), mundo: base.mundo };
      const alvo = motor.estado.alvo;
      if (alvo) frame.pontos![INDICE_PONTO.punho_d] = { x: alvo.x, y: alvo.y, z: 0, visibility: 0.95 };
      eventos.push(...motor.processar(frame));
    }
    expect(dosTipo(eventos, "alvo_acerto")).toHaveLength(5);
    // Fase 2: parado, sem tocar: os alvos vencem a cada 2 s.
    const fim = t + 8000;
    while (t < fim) eventos.push(...motor.processar({ ...base, t: (t += 33) }));
    const kpis = motor.kpis();
    expect(kpis.acertos).toBe(5);
    expect(kpis.alvos_perdidos).toBeGreaterThanOrEqual(3);
    expect(kpis.precisao).toBeCloseTo(5 / (5 + kpis.alvos_perdidos), 2);
    expect(kpis.tempo_reacao).toBeLessThan(0.2);
    expect(motor.estado.repsValidas).toBe(5);
  });

  it("os alvos aparecem dentro da tela e ao alcance das mãos", () => {
    const motor = new Motor(def, { proporcao: PROPORCAO, aleatorio: criarAleatorio(9), suavizar: false });
    const base = gerarFrame(0, {});
    const vistos = new Map<string, { x: number; y: number; raio: number }>();
    for (let t = 0; t < 60000; t += 33) {
      motor.processar({ ...base, t });
      const alvo = motor.estado.alvo;
      if (alvo) vistos.set(`${alvo.x.toFixed(3)},${alvo.y.toFixed(3)}`, alvo);
    }
    expect(vistos.size).toBeGreaterThan(10);
    for (const alvo of vistos.values()) {
      expect(alvo.x).toBeGreaterThan(0);
      expect(alvo.x).toBeLessThan(1);
      expect(alvo.y).toBeGreaterThan(0);
      expect(alvo.y).toBeLessThan(1);
    }
    // Aparecem dos dois lados do corpo.
    const lados = new Set([...vistos.values()].map((a) => (a.x < 0.5 ? "esq" : "dir")));
    expect(lados.size).toBe(2);
  });
});

describe("respiração guiada", () => {
  const def = definicao("respiracao_guiada");

  it("o tempo corre com a pessoa parada e para quando ela se mexe", () => {
    const mexendo: Trecho = { s: 6, pose: (u) => ({ balanco: 0.15 * Math.sin(u * 6 * 2 * Math.PI * 1.2), bracos: 30 + 60 * Math.abs(Math.sin(u * 20)) }) };
    const { kpis, eventos } = rodar(def, gerarSequencia([parado(10), mexendo, parado(10)], { ruido: 0.002 }));
    expect(kpis.tempo_valido_s).toBeGreaterThan(16);
    expect(kpis.tempo_valido_s).toBeLessThan(21);
    expect(kpis.pct_tempo_valido).toBeGreaterThan(0.6);
    expect(kpis.pct_tempo_valido).toBeLessThan(0.82);
    expect(dosTipo(eventos, "posicao_perdida")[0].feedback).toBe("Fique parado e respire");
  });

  it("funciona sentado, só com os ombros visíveis", () => {
    const frames = gerarSequencia([parado(8, { visibilidadePes: 0.1 })], { ruido: 0.002 });
    expect(rodar(def, frames).kpis.tempo_valido_s).toBeGreaterThan(6.5);
  });
});

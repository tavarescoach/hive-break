import { describe, expect, it } from "vitest";
import { FiltroOneEuro } from "../filtro-one-euro";
import { angulo, desvioPadrao, distancia, media, vetor } from "../geometria";
import { calcularMedida, prepararPose } from "../medidas";
import { gerarFrame, PROPORCAO } from "./sintetico";

describe("geometria", () => {
  it("mede ângulos em graus, com 180 para segmento reto", () => {
    expect(angulo(vetor(0, 0), vetor(0, 1), vetor(0, 2))).toBeCloseTo(180);
    expect(angulo(vetor(1, 0), vetor(0, 0), vetor(0, 1))).toBeCloseTo(90);
    expect(angulo(vetor(1, 0, 0), vetor(0, 0, 0), vetor(0, 0, 1))).toBeCloseTo(90);
    expect(angulo(vetor(1, 0), vetor(0, 0), vetor(1, 1))).toBeCloseTo(45);
  });

  it("devolve NaN quando um segmento tem comprimento zero", () => {
    expect(angulo(vetor(0, 0), vetor(0, 0), vetor(1, 1))).toBeNaN();
  });

  it("calcula distância, média e desvio", () => {
    expect(distancia(vetor(0, 0), vetor(3, 4))).toBeCloseTo(5);
    expect(media([1, 2, 3])).toBe(2);
    expect(desvioPadrao([2, 2, 2])).toBe(0);
  });
});

describe("medidas no boneco sintético", () => {
  const medir = (params: Parameters<typeof gerarFrame>[1], def: Parameters<typeof calcularMedida>[0]) => {
    const frame = gerarFrame(0, params);
    return calcularMedida(def, prepararPose(frame.pontos!, frame.mundo, PROPORCAO));
  };

  it("ângulo 3D do joelho bate com o parâmetro, mesmo de frente", () => {
    const def = { tipo: "angulo", pontos: ["quadril", "joelho", "tornozelo"] } as const;
    for (const joelho of [175, 140, 100, 85]) {
      expect(medir({ joelho }, { ...def, pontos: [...def.pontos], espaco: "3d" })).toBeCloseTo(joelho, 0);
    }
  });

  it("ângulo 2D do joelho quase não muda de frente (por isso o motor usa 3D)", () => {
    const def = { tipo: "angulo" as const, pontos: ["quadril", "joelho", "tornozelo"] as [string, string, string], espaco: "2d" as const };
    expect(medir({ joelho: 85 }, def)).toBeGreaterThan(170);
  });

  it("corrige a proporção da imagem nas distâncias", () => {
    // Ombros (0,36 m) e tronco (0,5 m): a razão precisa ser a real, não a da imagem esticada.
    const razao = medir({}, { tipo: "distancia", pontos: ["ombro_e", "ombro_d"], normalizar_por: ["ombro", "quadril"] });
    expect(razao).toBeCloseTo(0.36 / 0.5, 2);
  });

  it("altura é positiva quando o segundo ponto está acima do primeiro", () => {
    const def = { tipo: "altura" as const, pontos: ["tornozelo_d", "tornozelo_e"] as [string, string], normalizar_por: ["ombro", "quadril"] as [string, string] };
    expect(medir({ peE: 0.25 }, def)).toBeCloseTo(0.5, 2);
    expect(medir({ peD: 0.25 }, def)).toBeCloseTo(-0.5, 2);
  });
});

describe("filtro One Euro", () => {
  it("reduz o tremor de um ponto parado", () => {
    const filtro = new FiltroOneEuro();
    let pior = 0;
    for (let i = 0; i < 120; i++) {
      const bruto = 0.5 + (i % 2 === 0 ? 0.004 : -0.004);
      const suave = filtro.filtrar(bruto, i * 33);
      if (i > 30) pior = Math.max(pior, Math.abs(suave - 0.5));
    }
    expect(pior).toBeLessThan(0.002);
  });

  it("acompanha um movimento rápido com pouco atraso", () => {
    const filtro = new FiltroOneEuro();
    let saida = 0;
    for (let i = 0; i < 30; i++) saida = filtro.filtrar(i < 10 ? 0 : 1, i * 33);
    expect(saida).toBeGreaterThan(0.97);
  });
});

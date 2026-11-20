/** Etapa 1C-A: medida "horizontal" e a combinação de lados "centro". */
import { describe, expect, it } from "vitest";
import { calcularMedida, prepararPose } from "../medidas";
import { INDICE_PONTO, TOTAL_PONTOS } from "../pontos";

const pose = (pontos: Record<string, [number, number]>) => {
  const lista = Array.from({ length: TOTAL_PONTOS }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  for (const [n, [x, y]] of Object.entries(pontos)) lista[INDICE_PONTO[n]] = { x, y, visibility: 1 };
  return prepararPose(lista, null, 1);
};

describe("medida horizontal", () => {
  const base = { ombro_e: [0.6, 0.3], ombro_d: [0.4, 0.3], quadril_e: [0.55, 0.6], quadril_d: [0.45, 0.6] } as Record<string, [number, number]>;

  it("b.x − a.x, dividido pela referência (positivo quando b está à direita)", () => {
    const p = pose({ ...base, punho_e: [0.62, 0.4], punho_d: [0.58, 0.4] });
    // punho médio x = 0,60; quadril médio x = 0,50; largura dos ombros = 0,20 → 0,5
    expect(calcularMedida({ tipo: "horizontal", pontos: ["quadril", "punho"], normalizar_por: ["ombro_e", "ombro_d"] }, p)).toBeCloseTo(0.5);
  });

  it("sem referência, devolve a diferença crua; negativo quando b está à esquerda", () => {
    const p = pose({ ...base, nariz: [0.45, 0.2] });
    expect(calcularMedida({ tipo: "horizontal", pontos: ["ombro", "nariz"] }, p)).toBeCloseTo(-0.05);
  });
});

describe("lado: centro", () => {
  it("ângulo no ponto médio entre os quadris (abdução em pé), sem medir lado a lado", () => {
    const p = pose({ quadril_e: [0.55, 0.5], quadril_d: [0.45, 0.5], tornozelo_e: [0.7, 0.9], tornozelo_d: [0.3, 0.9] });
    const graus = calcularMedida({ tipo: "angulo", pontos: ["tornozelo_e", "quadril", "tornozelo_d"], lado: "centro", espaco: "2d" }, p);
    expect(graus).toBeCloseTo((2 * Math.atan(0.2 / 0.4) * 180) / Math.PI, 1);
  });
});

import { describe, expect, it } from "vitest";
import { analisar, avaliarCondicao, avaliarNumero, variaveisUsadas, type Contexto } from "../expressao";

const ctx = (valores: Record<string, number>, dists: Record<string, number> = {}): Contexto => ({
  variavel: (nome) => valores[nome] ?? NaN,
  dist: (pontos) => dists[pontos.join(",")] ?? NaN,
  vis: (ponto) => valores[`vis:${ponto}`] ?? NaN,
});

const testar = (texto: string, valores: Record<string, number>, folga = 0, dists = {}) =>
  avaliarCondicao(analisar(texto), ctx(valores, dists), folga);

describe("interpretador de condições", () => {
  it("compara medidas com números", () => {
    expect(testar("medida > 160", { medida: 170 })).toBe(true);
    expect(testar("medida > 160", { medida: 150 })).toBe(false);
    expect(testar("medida < 100", { medida: 99.5 })).toBe(true);
    expect(testar("medida >= 100", { medida: 100 })).toBe(true);
    expect(testar("medida <= 99", { medida: 100 })).toBe(false);
  });

  it("entende 'entre A e B' como na especificação", () => {
    expect(testar("min_medida entre 100 e 120", { min_medida: 110 })).toBe(true);
    expect(testar("min_medida entre 100 e 120", { min_medida: 95 })).toBe(false);
    expect(testar("min_medida entre 100 e 120 e x > 1", { min_medida: 110, x: 2 })).toBe(true);
    expect(testar("min_medida entre 100 e 120 e x > 1", { min_medida: 110, x: 0 })).toBe(false);
  });

  it("combina com e, ou, nao e parênteses", () => {
    expect(testar("a > 1 e b < 2", { a: 2, b: 1 })).toBe(true);
    expect(testar("a > 1 e b < 2", { a: 2, b: 3 })).toBe(false);
    expect(testar("a > 1 ou b < 2", { a: 0, b: 1 })).toBe(true);
    expect(testar("nao a > 1", { a: 0 })).toBe(true);
    expect(testar("não (a > 1 ou b > 1)", { a: 0, b: 5 })).toBe(false);
  });

  it("faz contas e chama dist(), como no exemplo do valgo", () => {
    const dists = { joelhos: 0.15, tornozelos: 0.2 };
    expect(testar("dist(joelhos) < 0.8 * dist(tornozelos)", {}, 0, dists)).toBe(true);
    expect(testar("dist(joelhos) < 0.8 * dist(tornozelos)", {}, 0, { joelhos: 0.19, tornozelos: 0.2 })).toBe(false);
    expect(avaliarNumero(analisar("abs(-3) + max(1, 2) * 2 - 6 / 3"), ctx({}))).toBe(5);
    expect(avaliarNumero(analisar("-(2 + 3)"), ctx({}))).toBe(-5);
  });

  it("vis() lê a visibilidade dos pontos", () => {
    expect(testar("vis(tornozelos) > 0.7 e medida < 100", { "vis:tornozelos": 0.9, medida: 90 })).toBe(true);
    expect(testar("vis(tornozelos) > 0.7 e medida < 100", { "vis:tornozelos": 0.4, medida: 90 })).toBe(false);
    expect(() => analisar("vis(1)")).toThrow();
  });

  it("aplica a folga da histerese só para manter a condição", () => {
    expect(testar("medida > 160", { medida: 157 }, 0)).toBe(false);
    expect(testar("medida > 160", { medida: 157 }, 5)).toBe(true);
    expect(testar("medida < 100", { medida: 103 }, 5)).toBe(true);
    expect(testar("medida < 100", { medida: 106 }, 5)).toBe(false);
    expect(testar("abs(medida) > 0.15", { medida: -0.12 }, 0.04)).toBe(true);
  });

  it("valor indisponível torna a comparação falsa", () => {
    expect(testar("medida > 160", {})).toBe(false);
    expect(testar("medida < 160", {})).toBe(false);
  });

  it("lista as variáveis usadas", () => {
    expect([...variaveisUsadas(analisar("medida < 1.0 e maos_ombro < 0 ou max_medida > 2"))].sort()).toEqual([
      "maos_ombro",
      "max_medida",
      "medida",
    ]);
  });

  it("recusa texto inválido em vez de executar qualquer coisa", () => {
    for (const texto of ["medida >", "medida > 160 )", "alert(1)", "medida == 3", "a > 1; b", "e > 1", "dist(1)"]) {
      expect(() => analisar(texto), texto).toThrow();
    }
    expect(() => avaliarCondicao(analisar("medida + 1"), ctx({ medida: 1 }))).toThrow();
  });
});

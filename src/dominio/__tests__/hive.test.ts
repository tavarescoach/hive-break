import { describe, expect, it } from "vitest";
import { bonusPorTamanho } from "../hive";

describe("bonusPorTamanho", () => {
  it("bate com a tabela da seção 3 de docs/BONUS_HIVE.md", () => {
    expect(bonusPorTamanho(1)).toBe(0);
    expect(bonusPorTamanho(2)).toBe(10);
    expect(bonusPorTamanho(3)).toBe(18);
    expect(bonusPorTamanho(4)).toBe(23);
    expect(bonusPorTamanho(5)).toBe(27);
    expect(bonusPorTamanho(6)).toBe(30);
    expect(bonusPorTamanho(8)).toBe(36);
    expect(bonusPorTamanho(10)).toBe(40);
    expect(bonusPorTamanho(15)).toBe(47);
    expect(bonusPorTamanho(20)).toBe(53);
    expect(bonusPorTamanho(30)).toBe(60);
  });

  it("tem teto de 60%, mesmo com hives bem maiores", () => {
    expect(bonusPorTamanho(50)).toBe(60);
  });

  it("sozinho (n=0 ou 1) não tem bônus", () => {
    expect(bonusPorTamanho(0)).toBe(0);
    expect(bonusPorTamanho(1)).toBe(0);
  });
});

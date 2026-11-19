import { describe, expect, it } from "vitest";
import { calcularBarraPeso, formatarVariacao } from "../peso";

describe("barra de peso (nunca vermelha)", () => {
  it("formata ganho e perda", () => {
    expect(formatarVariacao(1.5)).toBe("+1,5 kg ganhos");
    expect(formatarVariacao(-3)).toBe("−3 kg perdidos");
    expect(formatarVariacao(0)).toBe("0 kg ganhos");
  });

  it("anda na direção da meta: barra amarela e progresso proporcional", () => {
    // Meta: ganhar de 80 para 84 (+4). Foi a 81,5 (+1,5): 37,5% do caminho.
    const r = calcularBarraPeso({ inicial: 80, atual: 81.5, meta: 84, desde: "02/11" });
    expect(r.naDirecaoDaMeta).toBe(true);
    expect(r.pct).toBeCloseTo(37.5, 5);
    expect(r.rotulo).toBe("+1,5 kg ganhos desde 02/11");
  });

  it("anda para o lado contrário da meta: barra cinza, nunca negativa", () => {
    // Meta de ganhar peso, mas perdeu: cinza, 0%, sem culpa no texto.
    const r = calcularBarraPeso({ inicial: 80, atual: 78, meta: 84, desde: "02/11" });
    expect(r.naDirecaoDaMeta).toBe(false);
    expect(r.pct).toBe(0);
    expect(r.rotulo).toBe("−2 kg perdidos desde 02/11");
  });

  it("passou da meta: trava em 100%", () => {
    const r = calcularBarraPeso({ inicial: 80, atual: 90, meta: 84, desde: "02/11" });
    expect(r.pct).toBe(100);
  });

  it("sem meta (objetivo sem peso): sem barra, só a variação", () => {
    const r = calcularBarraPeso({ inicial: 80, atual: 78.5, meta: null, desde: "02/11" });
    expect(r.pct).toBe(0);
    expect(r.naDirecaoDaMeta).toBe(true);
  });
});

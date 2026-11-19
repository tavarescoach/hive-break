import { describe, expect, it } from "vitest";
import { compararSemanas } from "../vocesDois";

describe("Vocês dois: comparação da semana", () => {
  it("junta os dois arrays de dias na mesma ordem", () => {
    const meus = [{ dia: "2026-11-16", hives: 2 }, { dia: "2026-11-17", hives: 0 }];
    const dele = [{ dia: "2026-11-16", hives: 1 }, { dia: "2026-11-17", hives: 3 }];
    expect(compararSemanas(meus, dele)).toEqual([
      { dia: "2026-11-16", eu: 2, dele: 1 },
      { dia: "2026-11-17", eu: 0, dele: 3 },
    ]);
  });

  it("dia faltando do outro lado conta como 0", () => {
    expect(compararSemanas([{ dia: "d", hives: 1 }], [])).toEqual([{ dia: "d", eu: 1, dele: 0 }]);
  });
});

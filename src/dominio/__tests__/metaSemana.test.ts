import { describe, expect, it } from "vitest";
import { diasComMetaBatida, estadoDoDia, semanaCompleta } from "../metaSemana";

describe("meta da semana", () => {
  it("estado do dia: cheia, meia ou vazia", () => {
    expect(estadoDoDia(0, 2)).toBe("vazia");
    expect(estadoDoDia(1, 2)).toBe("meia");
    expect(estadoDoDia(2, 2)).toBe("cheia");
    expect(estadoDoDia(3, 2)).toBe("cheia");
  });

  it("conta os dias em que a meta do dia foi batida", () => {
    const dias = [{ dia: "1", hives: 2 }, { dia: "2", hives: 1 }, { dia: "3", hives: 0 }, { dia: "4", hives: 3 }];
    expect(diasComMetaBatida(dias, 2)).toBe(2);
  });

  it("semana completa: dias batidos >= meta de dias por semana", () => {
    const dias = [{ dia: "1", hives: 2 }, { dia: "2", hives: 2 }, { dia: "3", hives: 0 }];
    expect(semanaCompleta(dias, 2, 2)).toBe(true);
    expect(semanaCompleta(dias, 2, 3)).toBe(false);
  });
});

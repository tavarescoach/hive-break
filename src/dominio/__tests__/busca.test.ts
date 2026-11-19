import { describe, expect, it } from "vitest";
import { estadoSeguir } from "../busca";

describe("estado do botão Seguir", () => {
  it("seguir, seguindo ou seguir de volta", () => {
    expect(estadoSeguir({ seguindo: false, segue_voce: false })).toBe("seguir");
    expect(estadoSeguir({ seguindo: true, segue_voce: false })).toBe("seguindo");
    expect(estadoSeguir({ seguindo: false, segue_voce: true })).toBe("seguir_de_volta");
    // Seguindo pesa mais: se os dois já se seguem, o botão mostra "Seguindo".
    expect(estadoSeguir({ seguindo: true, segue_voce: true })).toBe("seguindo");
  });
});

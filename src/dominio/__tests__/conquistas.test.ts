import { describe, expect, it } from "vitest";
import { proximaConquista, type ProgressoConquista } from "../conquistas";

const c = (p: Partial<ProgressoConquista>): ProgressoConquista => ({
  id: "x", nome: "X", descricao: "", conquistada: false, conquistada_em: null, atual: null, meta: null, ...p,
});

describe("próxima conquista mais perto", () => {
  it("escolhe a de maior progresso entre as não conquistadas", () => {
    const lista = [c({ id: "a", atual: 2, meta: 10 }), c({ id: "b", atual: 7, meta: 10 }), c({ id: "c", conquistada: true, atual: 10, meta: 10 })];
    expect(proximaConquista(lista)?.id).toBe("b");
  });

  it("ignora quem não tem atual/meta (critério sem contador)", () => {
    expect(proximaConquista([c({ id: "a", atual: null, meta: null })])).toBeNull();
  });

  it("sem nenhuma pendente, devolve null", () => {
    expect(proximaConquista([c({ conquistada: true, atual: 1, meta: 1 })])).toBeNull();
  });
});

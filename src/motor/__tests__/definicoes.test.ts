import { describe, expect, it } from "vitest";
import { EXERCICIOS } from "@/exercicios";
import { Motor } from "../motor";
import type { DefinicaoExercicio } from "../tipos";
import { validarDefinicao } from "../validar-definicao";
import { definicao } from "./apoio";

describe("definições de exercício", () => {
  it.each(EXERCICIOS.map((e) => [e.id, e] as const))("%s é válida", (_id, def) => {
    expect(validarDefinicao(def)).toEqual([]);
  });

  it("aponta os problemas de uma definição errada", () => {
    const def: DefinicaoExercicio = {
      ...definicao("agachamento_livre"),
      pontos_obrigatorios: ["joelho_x"],
      fases: [
        { nome: "topo", condicao: "medida > 160" },
        { nome: "fundo", condicao: "angulo_que_nao_existe < 100" },
      ],
      repeticao: ["topo", "meio", "fundo"],
      erros: [{ id: "x", condicao: "max_medida > 1", feedback: "x" }],
    };
    const problemas = validarDefinicao(def).join("\n");
    expect(problemas).toContain("joelho_x");
    expect(problemas).toContain("angulo_que_nao_existe");
    expect(problemas).toContain('fase inexistente "meio"');
    expect(problemas).toContain("começar e terminar na mesma fase");
    expect(problemas).toContain("max_medida");
    expect(() => new Motor(def)).toThrow(/Definição inválida/);
  });
});

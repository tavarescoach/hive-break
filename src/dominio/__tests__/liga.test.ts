import { describe, expect, it } from "vitest";
import { textoRegra, textoSemanaPassada, textoSemTreino, textoZona, type DadosLiga } from "../liga";

type NoGrupo = Extract<DadosLiga, { no_grupo: true }>;
const dados = (extra: Partial<NoGrupo>): NoGrupo => ({
  divisao: "prata", semana_fim: "2026-11-22", semana_passada: null, no_grupo: true,
  tamanho: 15, sobem: 4, descem: 3, posicao: 6, pontos: 50, sem_treino: 0, zona: "meio",
  faltam_para_subir: 21, faltam_para_ficar: null, linhas: [], ...extra,
});

describe("textos da liga", () => {
  it("zona de descida mostra só o que falta para ficar, sem posição", () => {
    const t = textoZona(dados({ zona: "descida", posicao: 14, faltam_para_ficar: 40 }));
    expect(t).toBe("Faltam 40 XP para você ficar na Prata.");
    expect(t).not.toMatch(/14|último/);
  });

  it("zona de subida e meio", () => {
    expect(textoZona(dados({ zona: "subida", posicao: 2 }))).toBe("Você está na zona de subida para o Ouro. Segura até domingo!");
    expect(textoZona(dados({}))).toBe("Faltam 21 XP para a zona de subida.");
    expect(textoZona(dados({ divisao: "diamante", sobem: 0, faltam_para_subir: null }))).toMatch(/Diamante/);
  });

  it("regra no tamanho do grupo", () => {
    expect(textoRegra(dados({}))).toBe("15 pessoas · sobem 4 · descem 3");
    expect(textoRegra(dados({ tamanho: 3, sobem: 1, descem: 0 }))).toBe("3 pessoas · sobe 1");
  });

  it("semana passada nunca fala em último", () => {
    expect(textoSemanaPassada({ divisao: "bronze", posicao: 1, resultado: "subiu" })).toBe("Você subiu para a Prata! Fechou a semana em 1º no Bronze.");
    expect(textoSemanaPassada({ divisao: "ouro", posicao: 9, resultado: "desceu" })).not.toMatch(/9|último|caiu/);
  });

  it("contagem de quem não treinou", () => {
    expect(textoSemTreino(0)).toBeNull();
    expect(textoSemTreino(1)).toBe("+1 pessoa do grupo ainda não treinou esta semana");
    expect(textoSemTreino(4)).toBe("+4 pessoas do grupo ainda não treinaram esta semana");
  });
});

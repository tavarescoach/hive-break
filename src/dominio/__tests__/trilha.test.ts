import { describe, expect, it } from "vitest";
import { formatarDuracao, montarCaminho, type DadosTrilha, type DesafioTrilha, type EstadoDesafio } from "../trilha";

function dados(estados: EstadoDesafio[], extras: Partial<DadosTrilha> = {}): DadosTrilha {
  // Uma seção com uma unidade de 8 desafios + final, e uma segunda seção bloqueada.
  const desafio = (id: string, level: number, unit: string, ordem: number, estado: EstadoDesafio, tipo: "desafio" | "final" = "desafio"): DesafioTrilha => ({
    id, unit_id: unit, level_id: level, ordem, titulo: id, modalidade: "forca", duracao_s: 300, intensidade: "baixa", equipamento: null, tipo, xp: tipo === "final" ? 20 : 10, estado,
  });
  return {
    nivel_atual: 1, liberado_alta_intensidade: true, ofensiva: 0, fez_hoje: false, xp_hoje: 0, meta_xp: 30,
    niveis: [
      { id: 1, ordem: 1, tema: "Um", equipamentos: [], liberado: true, concluido: false },
      { id: 2, ordem: 2, tema: "Dois", equipamentos: ["tapete"], liberado: false, concluido: false },
    ],
    unidades: [
      { id: "n1u1", level_id: 1, ordem: 1, titulo: "U1", descricao: null },
      { id: "n2u1", level_id: 2, ordem: 1, titulo: "U2", descricao: null },
    ],
    desafios: [
      ...estados.map((e, i) => desafio(i === 8 ? "n1u1final" : `n1u1d0${i + 1}`, 1, "n1u1", i + 1, e, i === 8 ? "final" : "desafio")),
      desafio("n2u1d01", 2, "n2u1", 1, "bloqueado"),
    ],
    baus_abertos: [],
    ...extras,
  };
}

const C = "concluido", D = "disponivel", B = "bloqueado", T = "travado";

describe("caminho da trilha", () => {
  it("põe um baú a cada 4 desafios e o desafio da unidade no fim", () => {
    const { secoes } = montarCaminho(dados([D, B, B, B, B, B, B, B, B]));
    expect(secoes[0].unidades[0].itens.map((i) => i.tipo)).toEqual([
      "desafio", "desafio", "desafio", "desafio", "bau", "desafio", "desafio", "desafio", "desafio", "bau", "final",
    ]);
  });

  it("faz o zigue-zague", () => {
    const { secoes } = montarCaminho(dados([D, B, B, B, B, B, B, B, B]));
    expect(secoes[0].unidades[0].itens.map((i) => i.deslocamento)).toEqual([0, 1, 2, 1, 0, -1, -2, -1, 0, 1, 2]);
  });

  it("marca como atual o primeiro disponível da seção atual", () => {
    expect(montarCaminho(dados([C, C, D, B, B, B, B, B, B])).atual).toBe("n1u1d03");
    expect(montarCaminho(dados([C, C, C, C, C, C, C, C, C])).atual).toBeNull();
    // Depois de pular para a seção 2, o atual passa a ser de lá.
    const pulou = dados([D, B, B, B, B, B, B, B, B], { nivel_atual: 2 });
    pulou.desafios.at(-1)!.estado = "disponivel";
    expect(montarCaminho(pulou).atual).toBe("n2u1d01");
  });

  it("baú: bloqueado enquanto há pendência antes, disponível depois, aberto quando já foi", () => {
    const baus = (d: DadosTrilha) => montarCaminho(d).secoes[0].unidades[0].itens.filter((i) => i.tipo === "bau").map((i) => i.estado);
    expect(baus(dados([C, C, C, D, B, B, B, B, B]))).toEqual(["bloqueado", "bloqueado"]);
    expect(baus(dados([C, C, C, C, D, B, B, B, B]))).toEqual(["disponivel", "bloqueado"]);
    expect(baus(dados([C, C, C, C, D, B, B, B, B], { baus_abertos: [{ unit_id: "n1u1", posicao: 4 }] }))).toEqual(["aberto", "bloqueado"]);
    // Desafios travados pela triagem não seguram o baú.
    expect(baus(dados([C, C, T, T, D, B, B, B, T]))).toEqual(["disponivel", "bloqueado"]);
  });

  it("calcula o progresso de cada seção", () => {
    const { secoes } = montarCaminho(dados([C, C, C, D, B, B, B, B, B]));
    expect(secoes.map((s) => [s.feitos, s.total, s.liberada])).toEqual([[3, 9, true], [0, 1, false]]);
  });

  it("formata a duração", () => {
    expect([45, 60, 210, 300].map(formatarDuracao)).toEqual(["45 s", "1 min", "3 min 30 s", "5 min"]);
  });
});

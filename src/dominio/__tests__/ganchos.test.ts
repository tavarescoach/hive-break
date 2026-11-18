import { describe, expect, it } from "vitest";
import { buscarGancho } from "@/conteudo/ganchos";
import {
  escolherGancho, ganchoValido, preencherGancho, trocarGancho, variaveisDoTexto, type EstadoDoTreino,
} from "../ganchos";

const COMPLETO: EstadoDoTreino["variaveis"] = { nome: "Luan", reps: 62, exercicio: "agachamento", tempo: "1 min", dias: 9 };

function estado(parcial: Partial<EstadoDoTreino> = {}): EstadoDoTreino {
  return { recordeNovo: false, ofensivaDias: 3, emHive: false, variaveis: COMPLETO, ...parcial };
}

describe("variaveisDoTexto e ganchoValido", () => {
  it("lista as variáveis do texto", () => {
    expect(variaveisDoTexto("{nome} fez {reps} {exercicio} em {tempo}. Você bate?")).toEqual(["nome", "reps", "exercicio", "tempo"]);
    expect(variaveisDoTexto("Bora um break de 3 minutos comigo?")).toEqual([]);
  });

  it("gancho é inválido se faltar variável ou contexto", () => {
    const d01 = buscarGancho("D01")!;
    expect(ganchoValido(d01, "compartilhar_treino", COMPLETO)).toBe(true);
    expect(ganchoValido(d01, "compartilhar_treino", {})).toBe(false);
    expect(ganchoValido(d01, "outro" as never, COMPLETO)).toBe(false);
  });
});

describe("escolherGancho — tabela 3.1", () => {
  it("bateu recorde: escolhe entre D04, D08, D13", () => {
    const g = escolherGancho("compartilhar_treino", estado({ recordeNovo: true }), () => 0);
    expect(["D04", "D08", "D13"]).toContain(g?.id);
  });

  it("bateu recorde sem {reps}: só D13 continua válido", () => {
    const g = escolherGancho("compartilhar_treino", estado({ recordeNovo: true, variaveis: {} }), () => 0.9);
    expect(g?.id).toBe("D13");
  });

  it("ofensiva de 7 dias ou mais: escolhe entre D06 e C06", () => {
    const g = escolherGancho("compartilhar_treino", estado({ ofensivaDias: 9 }), () => 0);
    expect(["D06", "C06"]).toContain(g?.id);
  });

  it("1º dia (ofensiva <= 1): C04", () => {
    const g = escolherGancho("compartilhar_treino", estado({ ofensivaDias: 1 }), () => 0);
    expect(g?.id).toBe("C04");
  });

  it("Modo Escritório: escolhe entre B01, B04, B06, B13, B14", () => {
    const g = escolherGancho("compartilhar_treino", estado({ modoEscritorio: true }), () => 0);
    expect(["B01", "B04", "B06", "B13", "B14"]).toContain(g?.id);
  });

  it("treinou em hive: escolhe entre C03, C05 e C07", () => {
    const g = escolherGancho("compartilhar_treino", estado({ emHive: true }), () => 0);
    expect(["C03", "C05", "C07"]).toContain(g?.id);
  });

  it("recorde tem prioridade sobre os outros estados", () => {
    const g = escolherGancho("compartilhar_treino", estado({ recordeNovo: true, emHive: true, ofensivaDias: 20 }), () => 0);
    expect(["D04", "D08", "D13"]).toContain(g?.id);
  });

  it("demais casos: rotação igual entre D, B e C", () => {
    const familias = new Set<string>();
    // 6 "sorteios" cobrindo as 3 famílias em pontos diferentes do intervalo [0,1).
    for (const valor of [0, 0.2, 0.34, 0.5, 0.7, 0.9]) {
      const g = escolherGancho("compartilhar_treino", estado(), () => valor);
      if (g) familias.add(g.familia);
    }
    expect(familias).toEqual(new Set(["D", "B", "C"]));
  });

  it("sem nenhuma variável, ainda cai em algum gancho sem variáveis nos demais casos", () => {
    const g = escolherGancho("compartilhar_treino", estado({ variaveis: {} }), () => 0);
    expect(g).not.toBeNull();
    expect(variaveisDoTexto(g!.texto)).toEqual([]);
  });
});

describe("trocarGancho", () => {
  it("troca por outro gancho da mesma família, nunca o mesmo", () => {
    const atual = buscarGancho("D01")!;
    const outro = trocarGancho(atual, "compartilhar_treino", COMPLETO, () => 0);
    expect(outro?.familia).toBe("D");
    expect(outro?.id).not.toBe("D01");
  });

  it("sem outro gancho válido no contexto, devolve null", () => {
    const atual = buscarGancho("C01")!;
    const outro = trocarGancho(atual, "outro" as never, COMPLETO, () => 0);
    expect(outro).toBeNull();
  });
});

describe("preencherGancho", () => {
  it("substitui as variáveis presentes e mantém as ausentes", () => {
    expect(preencherGancho("{nome} fez {reps} {exercicio} em {tempo}. Você bate?", COMPLETO))
      .toBe("Luan fez 62 agachamento em 1 min. Você bate?");
    expect(preencherGancho("{dias} dias seguidos. Quantos você aguenta?", {})).toBe("{dias} dias seguidos. Quantos você aguenta?");
  });
});

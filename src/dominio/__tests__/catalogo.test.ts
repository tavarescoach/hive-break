import { describe, expect, it } from "vitest";
import { Contexto, ExercicioCatalogo, Licao, Objeto, type BlocoLicao } from "../catalogo";

const CATALOGO_VALIDO = {
  nome: "Agachamento livre",
  familia: "agachamento",
  degrau: 1,
  funcoes: ["agachar"],
  regioes: ["pernas"],
  posicaoCamera: "frente",
  validacao: "V1",
  equipamento: "E0",
  flags: { semChao: true, semSalto: true, semSuor: false, silencioso: true },
  calibrado: true,
};

describe("ExercicioCatalogo", () => {
  it("aceita o mínimo válido e aplica os padrões (objetos, pesoPorTrilha)", () => {
    const r = ExercicioCatalogo.parse(CATALOGO_VALIDO);
    expect(r.objetos).toEqual([]);
    expect(r.pesoPorTrilha).toEqual({});
  });

  it("recusa mais de 3 funções", () => {
    expect(() =>
      ExercicioCatalogo.parse({ ...CATALOGO_VALIDO, funcoes: ["agachar", "dobrar", "avancar", "empurrar"] }),
    ).toThrow();
  });

  it("recusa função fora da lista fechada", () => {
    expect(() => ExercicioCatalogo.parse({ ...CATALOGO_VALIDO, funcoes: ["voar"] })).toThrow();
  });

  it("recusa degrau negativo", () => {
    expect(() => ExercicioCatalogo.parse({ ...CATALOGO_VALIDO, degrau: -1 })).toThrow();
  });

  it("aceita substitutoE0Id e objetos para equipamento E1+", () => {
    const r = ExercicioCatalogo.parse({
      ...CATALOGO_VALIDO,
      equipamento: "E1",
      objetos: ["cabo_vassoura"],
      substitutoE0Id: "agachamento_livre",
    });
    expect(r.substitutoE0Id).toBe("agachamento_livre");
  });
});

describe("Objeto", () => {
  it("aceita o formato dos objetos iniciais", () => {
    const r = Objeto.parse({
      id: "garrafa_1_5l",
      nome: "Garrafa de 1,5 L",
      cargaKgMin: 1.5,
      cargaKgMax: 1.5,
      pegada: "uma-mao",
      seguranca: "Tampa bem fechada.",
    });
    expect(r.id).toBe("garrafa_1_5l");
  });

  it("recusa pegada fora da lista", () => {
    expect(() =>
      Objeto.parse({ id: "x", nome: "X", cargaKgMin: 0, cargaKgMax: 1, pegada: "com-os-dentes", seguranca: "..." }),
    ).toThrow();
  });
});

describe("Contexto", () => {
  it("aceita um contexto válido", () => {
    const r = Contexto.parse({
      id: "mesa",
      nome: "Mesa",
      regras: { semChao: true, semSalto: true, semSuor: true, silencioso: false, interrompivel: true },
    });
    expect(r.id).toBe("mesa");
  });

  it("recusa id fora da lista fechada", () => {
    expect(() =>
      Contexto.parse({
        id: "academia",
        nome: "Academia",
        regras: { semChao: false, semSalto: false, semSuor: false, silencioso: false, interrompivel: false },
      }),
    ).toThrow();
  });
});

describe("Licao", () => {
  const BLOCO_VALIDO: BlocoLicao = { exercicioId: "agachamento_livre", series: 3, esforcoS: 30, pausaS: 20 };

  it("aceita o mínimo válido, com pausaEntreBlocosS e variantes vazias por padrão", () => {
    const r = Licao.parse({
      id: "n1u1d01", secaoId: "n1", ordem: 1, titulo: "Aquecimento", blocos: [BLOCO_VALIDO], duracaoExibidaS: 90, contextos: ["casa"],
    });
    expect(r.pausaEntreBlocosS).toBe(0);
    expect(r.variantes).toEqual({});
  });

  it("recusa lição sem contexto", () => {
    expect(() =>
      Licao.parse({ id: "x", secaoId: "n1", ordem: 1, titulo: "X", blocos: [BLOCO_VALIDO], duracaoExibidaS: 90, contextos: [] }),
    ).toThrow();
  });

  it("recusa contexto fora da lista fechada", () => {
    expect(() =>
      Licao.parse({
        id: "x", secaoId: "n1", ordem: 1, titulo: "X", blocos: [BLOCO_VALIDO], duracaoExibidaS: 90, contextos: ["escritorio"],
      }),
    ).toThrow();
  });

  it("aceita as variantes como ids de outra lição", () => {
    const r = Licao.parse({
      id: "x", secaoId: "n1", ordem: 1, titulo: "X", blocos: [BLOCO_VALIDO], duracaoExibidaS: 90, contextos: ["casa"],
      variantes: { curta3: "x-curta", snack1: "x-snack" },
    });
    expect(r.variantes.curta3).toBe("x-curta");
  });
});

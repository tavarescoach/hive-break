import { describe, expect, it } from "vitest";
import { validarCatalogo, type EntradaValidacao, type ExercicioBruto } from "../../../scripts/validar-catalogo";

const FLAGS_OK = { semChao: true, semSalto: true, semSuor: true, silencioso: true };

function exercicio(id: string, extra: Record<string, unknown> = {}): ExercicioBruto {
  return {
    id,
    catalogo: {
      nome: id,
      familia: id,
      degrau: 0,
      funcoes: ["agachar"],
      regioes: ["pernas"],
      posicaoCamera: "frente",
      validacao: "V1",
      equipamento: "E0",
      flags: FLAGS_OK,
      calibrado: false,
      ...extra,
    },
  };
}

const CONTEXTO_CASA = {
  id: "casa",
  nome: "Casa",
  regras: { semChao: false, semSalto: false, semSuor: false, silencioso: false, interrompivel: false },
};
const CONTEXTO_MESA = {
  id: "mesa",
  nome: "Mesa",
  regras: { semChao: true, semSalto: true, semSuor: true, silencioso: true, interrompivel: true },
};

function base(extra: Partial<EntradaValidacao> = {}): EntradaValidacao {
  return { exercicios: [exercicio("a")], objetos: [], contextos: [CONTEXTO_CASA, CONTEXTO_MESA], licoes: [], ...extra };
}

function licao(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    secaoId: "n1",
    ordem: 1,
    titulo: id,
    blocos: [{ exercicioId: "a", series: 3, esforcoS: 30, pausaS: 20 }],
    pausaEntreBlocosS: 10,
    // 3 séries de 30 s com pausa de 20 s entre elas (só 1 bloco, sem pausa entre blocos) = 3*30 + 2*20 = 130 s.
    duracaoExibidaS: 130,
    contextos: ["casa"],
    ...extra,
  };
}

describe("validarCatalogo · exercícios", () => {
  it("catálogo mínimo válido não gera erro nem aviso", () => {
    const r = validarCatalogo(base());
    expect(r).toEqual({ erros: [], avisos: [] });
  });

  it("equipamento E1 sem substitutoE0Id é erro; com substitutoE0Id válido, passa", () => {
    const semSub = validarCatalogo(base({ exercicios: [exercicio("a", { equipamento: "E1" })] }));
    expect(semSub.erros).toEqual([expect.stringContaining('exercício "a": equipamento E1 sem substitutoE0Id')]);

    const comSub = validarCatalogo(
      base({ exercicios: [exercicio("a", { equipamento: "E1", substitutoE0Id: "b" }), exercicio("b")] }),
    );
    expect(comSub.erros).toEqual([]);
  });

  it("substitutoE0Id apontando para id inexistente é erro", () => {
    const r = validarCatalogo(base({ exercicios: [exercicio("a", { equipamento: "E1", substitutoE0Id: "nao_existe" })] }));
    expect(r.erros).toEqual([expect.stringContaining('substitutoE0Id "nao_existe" não existe')]);
  });

  it("exercício com salto (semSalto: false) sem versaoSemImpactoId é erro; com, passa", () => {
    const semVersao = validarCatalogo(base({ exercicios: [exercicio("a", { flags: { ...FLAGS_OK, semSalto: false } })] }));
    expect(semVersao.erros).toEqual([expect.stringContaining("tem salto (flags.semSalto = false) sem versaoSemImpactoId")]);

    const comVersao = validarCatalogo(
      base({
        exercicios: [exercicio("a", { flags: { ...FLAGS_OK, semSalto: false }, versaoSemImpactoId: "b" }), exercicio("b")],
      }),
    );
    expect(comVersao.erros).toEqual([]);
  });

  it("versaoSemImpactoId e variacaoDe apontando para id inexistente são erro", () => {
    const r1 = validarCatalogo(
      base({ exercicios: [exercicio("a", { flags: { ...FLAGS_OK, semSalto: false }, versaoSemImpactoId: "x" })] }),
    );
    expect(r1.erros).toEqual([expect.stringContaining('versaoSemImpactoId "x" não existe')]);

    const r2 = validarCatalogo(base({ exercicios: [exercicio("a", { variacaoDe: "x" })] }));
    expect(r2.erros).toEqual([expect.stringContaining('variacaoDe "x" não existe')]);
  });

  it("variacao_facil e alternativas (campos legados) apontando para id inexistente são erro", () => {
    const r = validarCatalogo(
      base({ exercicios: [{ ...exercicio("a"), variacao_facil: "x", alternativas: { joelho: "y" } }] }),
    );
    expect(r.erros).toContain('exercício "a": variacao_facil "x" não existe');
    expect(r.erros).toContain('exercício "a": alternativas.joelho "y" não existe');
  });

  it("catálogo que não casa com o schema (campo faltando) é erro", () => {
    const r = validarCatalogo(base({ exercicios: [{ id: "a", catalogo: { nome: "a" } }] }));
    expect(r.erros).toEqual([expect.stringContaining('exercício "a": catálogo inválido')]);
  });
});

describe("validarCatalogo · objetos", () => {
  it("objeto referenciado que não existe em content/objetos.json é erro", () => {
    const r = validarCatalogo(base({ exercicios: [exercicio("a", { equipamento: "E1", substitutoE0Id: "a", objetos: ["bastao"] })] }));
    expect(r.erros).toContain('exercício "a": objeto "bastao" não existe em content/objetos.json');
  });

  it("objeto existente passa", () => {
    const objeto = { id: "bastao", nome: "Bastão", cargaKgMin: 0, cargaKgMax: 1, pegada: "duas-maos", seguranca: "Liso, sem lasca." };
    const r = validarCatalogo(
      base({ exercicios: [exercicio("a", { equipamento: "E1", substitutoE0Id: "a", objetos: ["bastao"] })], objetos: [objeto] }),
    );
    expect(r.erros).toEqual([]);
  });

  it("objeto que não casa com o schema é erro", () => {
    const r = validarCatalogo(base({ objetos: [{ id: "x", nome: "X", cargaKgMin: 0, cargaKgMax: 1, pegada: "boca", seguranca: "..." }] }));
    expect(r.erros).toEqual([expect.stringContaining("objetos[0]: inválido")]);
  });
});

describe("validarCatalogo · contextos", () => {
  it("contexto que não casa com o schema é erro", () => {
    const r = validarCatalogo(base({ contextos: [{ id: "academia", nome: "Academia", regras: {} }] }));
    expect(r.erros).toEqual([expect.stringContaining("contextos[0]: inválido")]);
  });
});

describe("validarCatalogo · lições", () => {
  it("lição sem contexto é erro", () => {
    const r = validarCatalogo(base({ licoes: [licao("l1", { contextos: [] })] }));
    expect(r.erros).toEqual([expect.stringContaining('lição "l1": inválida')]);
  });

  it("lição com contexto inexistente em content/contextos.json é erro", () => {
    const r = validarCatalogo(base({ licoes: [licao("l1", { contextos: ["sala"] })], contextos: [CONTEXTO_CASA] }));
    expect(r.erros).toContain('lição "l1": contexto "sala" não existe em content/contextos.json');
  });

  it("bloco com exercicioId inexistente é erro", () => {
    const r = validarCatalogo(base({ licoes: [licao("l1", { blocos: [{ exercicioId: "fantasma", series: 1, pausaS: 0 }] })] }));
    expect(r.erros).toContain('lição "l1": bloco com exercicioId "fantasma" inexistente');
  });

  it("variante apontando para lição inexistente é erro", () => {
    const r = validarCatalogo(base({ licoes: [licao("l1", { variantes: { snack1: "nao-existe" } })] }));
    expect(r.erros).toContain('lição "l1": variantes.snack1 "nao-existe" não existe');
  });

  it("variante apontando para lição existente passa", () => {
    const r = validarCatalogo(
      base({ licoes: [licao("l1", { ordem: 1, variantes: { snack1: "l2" } }), licao("l2", { ordem: 2 })] }),
    );
    expect(r.erros).toEqual([]);
  });

  it("exercício incompatível com um contexto declarado é erro", () => {
    // Exercício "a" tem salto (silencioso: false); o contexto "mesa" exige silêncio.
    const r = validarCatalogo(
      base({
        exercicios: [exercicio("a", { flags: { ...FLAGS_OK, silencioso: false, semSalto: false }, versaoSemImpactoId: "a" })],
        licoes: [licao("l1", { contextos: ["mesa"], duracaoExibidaS: 130 })],
      }),
    );
    expect(r.erros).toEqual([expect.stringContaining('"a" incompatível com o contexto "mesa" (tem salto, faz ruído)')]);
  });

  it("exercício compatível com o contexto não gera erro de incompatibilidade", () => {
    const r = validarCatalogo(base({ licoes: [licao("l1", { contextos: ["mesa"], duracaoExibidaS: 130 })] }));
    expect(r.erros).toEqual([]);
  });

  it("lição no contexto mesa com PSE acima de 4 é erro", () => {
    const r = validarCatalogo(
      base({
        licoes: [
          licao("l1", {
            contextos: ["mesa"],
            blocos: [{ exercicioId: "a", series: 3, esforcoS: 30, pausaS: 20, pseAlvo: 7 }],
            duracaoExibidaS: 130,
          }),
        ],
      }),
    );
    expect(r.erros).toEqual([expect.stringContaining('contexto "mesa" pede PSE ≤ 4, mas "a" está com PSE 7')]);
  });

  it("lição no contexto mesa com PSE até 4 passa", () => {
    const r = validarCatalogo(
      base({
        licoes: [
          licao("l1", {
            contextos: ["mesa"],
            blocos: [{ exercicioId: "a", series: 3, esforcoS: 30, pausaS: 20, pseAlvo: 4 }],
            duracaoExibidaS: 130,
          }),
        ],
      }),
    );
    expect(r.erros).toEqual([]);
  });

  it("PSE acima de 4 fora do contexto mesa não é erro", () => {
    const r = validarCatalogo(
      base({
        licoes: [
          licao("l1", {
            contextos: ["casa"],
            blocos: [{ exercicioId: "a", series: 3, esforcoS: 30, pausaS: 20, pseAlvo: 9 }],
            duracaoExibidaS: 130,
          }),
        ],
      }),
    );
    expect(r.erros).toEqual([]);
  });

  it("duração calculada igual à exibida (dentro de 10 s) passa", () => {
    // 1 bloco: 3 séries de 30 s, pausa 20 s entre séries = 3*30 + 2*20 = 130 s (sem pausa entre blocos, só há 1).
    const r = validarCatalogo(base({ licoes: [licao("l1", { duracaoExibidaS: 130 })] }));
    expect(r.erros).toEqual([]);
  });

  it("duração calculada diferente da exibida em mais de 10 s é erro", () => {
    const r = validarCatalogo(base({ licoes: [licao("l1", { duracaoExibidaS: 200 })] }));
    expect(r.erros).toEqual([expect.stringContaining('duração calculada (130s) difere da exibida (200s)')]);
  });

  it("duração calculada diferente da exibida em até 10 s passa (tolerância)", () => {
    const r = validarCatalogo(base({ licoes: [licao("l1", { duracaoExibidaS: 138 })] }));
    expect(r.erros).toEqual([]);
  });

  it("mais de 1 troca de posição de câmera numa lição é aviso, não erro", () => {
    const frente = exercicio("a", { posicaoCamera: "frente" });
    const lado = exercicio("b", { posicaoCamera: "lado" });
    const r = validarCatalogo(
      base({
        exercicios: [frente, lado],
        licoes: [
          licao("l1", {
            blocos: [
              { exercicioId: "a", series: 1, esforcoS: 10, pausaS: 0 },
              { exercicioId: "b", series: 1, esforcoS: 10, pausaS: 0 },
              { exercicioId: "a", series: 1, esforcoS: 10, pausaS: 0 },
            ],
            pausaEntreBlocosS: 0,
            duracaoExibidaS: 30,
          }),
        ],
      }),
    );
    expect(r.erros).toEqual([]);
    // (a lição também avisa "2 exercícios novos", à parte: são regras independentes.)
    expect(r.avisos).toContainEqual(expect.stringContaining("2 trocas de posição de câmera"));
  });

  it("só 1 troca de posição de câmera não gera aviso de câmera", () => {
    const frente = exercicio("a", { posicaoCamera: "frente" });
    const lado = exercicio("b", { posicaoCamera: "lado" });
    const r = validarCatalogo(
      base({
        exercicios: [frente, lado],
        licoes: [
          licao("l1", {
            blocos: [
              { exercicioId: "a", series: 1, esforcoS: 10, pausaS: 0 },
              { exercicioId: "b", series: 1, esforcoS: 10, pausaS: 0 },
            ],
            pausaEntreBlocosS: 0,
            duracaoExibidaS: 20,
          }),
        ],
      }),
    );
    expect(r.avisos.some((a) => a.includes("troca"))).toBe(false);
  });

  it("mais de 1 exercício novo por lição na mesma seção é aviso", () => {
    const r = validarCatalogo(
      base({
        exercicios: [exercicio("a"), exercicio("b"), exercicio("c")],
        licoes: [
          licao("l1", { ordem: 1, blocos: [{ exercicioId: "a", series: 1, esforcoS: 10, pausaS: 0 }], duracaoExibidaS: 10 }),
          licao("l2", {
            ordem: 2,
            blocos: [
              { exercicioId: "b", series: 1, esforcoS: 10, pausaS: 0 },
              { exercicioId: "c", series: 1, esforcoS: 10, pausaS: 0 },
            ],
            duracaoExibidaS: 20,
          }),
        ],
      }),
    );
    expect(r.avisos).toEqual([expect.stringContaining('lição "l2" (seção "n1"): 2 exercícios novos')]);
  });

  it("1 exercício novo por lição não gera aviso", () => {
    const r = validarCatalogo(
      base({
        exercicios: [exercicio("a"), exercicio("b")],
        licoes: [
          licao("l1", { ordem: 1, blocos: [{ exercicioId: "a", series: 1, esforcoS: 10, pausaS: 0 }], duracaoExibidaS: 10 }),
          licao("l2", { ordem: 2, blocos: [{ exercicioId: "b", series: 1, esforcoS: 10, pausaS: 0 }], duracaoExibidaS: 10 }),
        ],
      }),
    );
    expect(r.avisos).toEqual([]);
  });

  it("exercício repetido numa lição mais adiante não conta como novo de novo", () => {
    // l1 só apresenta "a" (1 novo, sem aviso); l2 repete "a" e apresenta só "b" (1 novo, sem aviso).
    const r = validarCatalogo(
      base({
        exercicios: [exercicio("a"), exercicio("b")],
        licoes: [
          licao("l1", { ordem: 1, blocos: [{ exercicioId: "a", series: 1, esforcoS: 10, pausaS: 0 }], duracaoExibidaS: 10 }),
          licao("l2", {
            ordem: 2,
            blocos: [
              { exercicioId: "a", series: 1, esforcoS: 10, pausaS: 0 },
              { exercicioId: "b", series: 1, esforcoS: 10, pausaS: 0 },
            ],
            duracaoExibidaS: 20,
          }),
        ],
      }),
    );
    expect(r.avisos).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { blocosDoCard, fraseDaOfensiva, montarDadosCard, normalizarInstagram, recordeDoCard, type EntradaCard } from "../card";
import { compilar, type Bloco, type Estrutura, type ExercicioMetodo, type FaseTrabalho, type ResultadoFase } from "../metodos";

const AGACHAMENTO: ExercicioMetodo = { nome: "Agachamento", sustentacao: false, segPorRep: 3 };
const PRANCHA: ExercicioMetodo = { nome: "Prancha", sustentacao: true, segPorRep: 0, lateral: true };
const est = (blocos: Bloco[], extra: Partial<Estrutura> = {}): Estrutura => ({ versao: 2, organizacao: "sequencia", pausa_entre_blocos_s: 20, blocos, ...extra });

/** Resultados fictícios: um por fase de trabalho, na ordem. */
function resultados(e: Estrutura, ex: ExercicioMetodo[], valores: { reps?: number; seg?: number; ms?: number }[]): ResultadoFase[] {
  const linha = compilar(e, ex);
  const fases = linha.fases.map((f, i) => ({ f, i })).filter((x): x is { f: FaseTrabalho; i: number } => x.f.tipo === "trabalho");
  return valores.map((v, k) => ({
    fase: fases[k].i,
    exercicio: fases[k].f.exercicio,
    reps: v.reps ?? 0,
    parciais: 0,
    tempoValidoMs: (v.seg ?? 0) * 1000,
    duracaoMs: v.ms ?? 30_000,
    cumprida: true,
    interrompida: false,
  }));
}

const AMRAP = est([{ exercicio_id: "agachamento_livre", metodo: "amrap", series: 5, esforco_s: 40, pausa_s: 20, score: "total_reps" }]);
const CORE = est([
  { exercicio_id: "prancha", metodo: "isometria", series: 3, esforco_s: 30, pausa_s: 20, score: "tempo_valido" },
  { exercicio_id: "agachamento_livre", metodo: "amrap", series: 2, esforco_s: 30, pausa_s: 20, score: "total_reps" },
]);

describe("blocos do card", () => {
  it("reps: total grande e séries pequenas separadas por ·", () => {
    const r = resultados(AMRAP, [AGACHAMENTO], [14, 13, 12, 12, 11].map((reps) => ({ reps })));
    const [b] = blocosDoCard(compilar(AMRAP, [AGACHAMENTO]), r, ["Agachamento"]);
    expect(b).toMatchObject({ tipo: "reps", valor: "62", unidade: "reps", series: "14·13·12·12·11", numero: 62 });
  });

  it("isometria vira segundos válidos; um bloco por exercício", () => {
    const r = resultados(CORE, [PRANCHA, AGACHAMENTO], [{ seg: 28 }, { seg: 25 }, { seg: 30 }, { reps: 15 }, { reps: 12 }]);
    const blocos = blocosDoCard(compilar(CORE, [PRANCHA, AGACHAMENTO]), r, ["Prancha", "Agachamento"]);
    expect(blocos.map((b) => [b.exercicio, b.tipo, b.valor, b.unidade, b.series])).toEqual([
      ["Prancha", "segundos", "83", "s válidos", "28·25·30"],
      ["Agachamento", "reps", "27", "reps", "15·12"],
    ]);
  });

  it("contra o relógio mostra o tempo para completar", () => {
    const e = est([{ exercicio_id: "agachamento_livre", metodo: "for_time", series: 1, reps_alvo: 50, pausa_s: 0, score: "tempo_total" }], { teto_s: 300 });
    const r = resultados(e, [AGACHAMENTO], [{ reps: 50, ms: 192_000 }]);
    const [b] = blocosDoCard(compilar(e, [AGACHAMENTO]), r, ["Agachamento"]);
    expect(b).toMatchObject({ tipo: "tempo", valor: "3:12", unidade: "para completar", series: "" });
  });

  it("bloco sem nenhuma série feita (encerrou antes) não aparece", () => {
    const r = resultados(CORE, [PRANCHA, AGACHAMENTO], [{ seg: 28 }]);
    expect(blocosDoCard(compilar(CORE, [PRANCHA, AGACHAMENTO]), r, ["Prancha", "Agachamento"])).toHaveLength(1);
  });
});

describe("recorde", () => {
  const linha = compilar(AMRAP, [AGACHAMENTO]);
  const r = resultados(AMRAP, [AGACHAMENTO], [14, 13, 12, 12, 11].map((reps) => ({ reps })));

  it("bateu: mostra o novo valor e marca como novo", () => {
    expect(recordeDoCard(linha, r, ["Agachamento"], { 0: { reps: 58, segundos: 0 } })).toEqual({ texto: "Seu recorde: 62 reps", novo: true });
  });

  it("não bateu: mostra o recorde antigo", () => {
    expect(recordeDoCard(linha, r, ["Agachamento"], { 0: { reps: 70, segundos: 0 } })).toEqual({ texto: "Seu recorde: 70 reps", novo: false });
  });

  it("primeira vez com câmera: o treino de hoje é o recorde, sem selo de novo", () => {
    expect(recordeDoCard(linha, r, ["Agachamento"], {})).toEqual({ texto: "Seu recorde: 62 reps", novo: false });
  });

  it("sem dado (sem câmera ou erro): some", () => {
    expect(recordeDoCard(linha, r, ["Agachamento"], null)).toBeNull();
  });

  it("vários exercícios: diz de qual é o recorde", () => {
    const rc = resultados(CORE, [PRANCHA, AGACHAMENTO], [{ seg: 28 }, { seg: 25 }, { seg: 30 }, { reps: 15 }, { reps: 12 }]);
    expect(recordeDoCard(compilar(CORE, [PRANCHA, AGACHAMENTO]), rc, ["Prancha", "Agachamento"], { 0: { reps: 0, segundos: 70 } }))
      .toEqual({ texto: "Seu recorde em prancha: 83 s", novo: true });
  });
});

describe("dados do card", () => {
  const base: EntradaCard = {
    linha: compilar(AMRAP, [AGACHAMENTO]),
    resultados: resultados(AMRAP, [AGACHAMENTO], [{ reps: 10 }]),
    nomes: ["Agachamento"],
    ofensiva: 1,
    recordesAnteriores: null,
    hive: null,
    pse: null,
    usuario: "luan",
    instagram: null,
    desafio: "Pernas firmes",
    modalidade: "Força",
    quando: new Date(2026, 10, 17, 9, 5),
  };

  it("1 dia aparece com a frase de começo", () => {
    const d = montarDadosCard(base);
    expect([d.ofensiva, d.rotuloOfensiva, d.fraseOfensiva]).toEqual([1, "dia", "O 1º de muitos"]);
    expect(montarDadosCard({ ...base, ofensiva: 12 }).rotuloOfensiva).toBe("dias seguidos");
  });

  it("dado que não existe fica null (o card esconde o item)", () => {
    const d = montarDadosCard(base);
    expect([d.recorde, d.hive, d.pse, d.instagram]).toEqual([null, null, null, null]);
  });

  it("hive é só o total anônimo; PSE só com valor válido", () => {
    const d = montarDadosCard({ ...base, hive: { fizeram: 6, total: 8 }, pse: 7 });
    expect(d.hive).toBe("6 de 8 da hive já fizeram hoje");
    expect(d.pse).toBe("Esforço 7 de 10");
  });

  it("nunca leva peso, medidas, calorias nem ranking", () => {
    const texto = JSON.stringify(montarDadosCard({ ...base, hive: { fizeram: 6, total: 8 }, pse: 7 })).toLowerCase();
    for (const proibido of ["kg", "peso", "cm", "caloria", "kcal", "posição", "lugar", "ranking"]) expect(texto).not.toContain(proibido);
  });

  it("data e hora no formato curto", () => {
    expect(montarDadosCard(base).quando).toBe("17 nov 2026 · 09:05");
  });
});

describe("apoio", () => {
  it("normaliza o @ do Instagram", () => {
    expect(normalizarInstagram("tavarescoach")).toBe("@tavarescoach");
    expect(normalizarInstagram("@@tavares.coach")).toBe("@tavares.coach");
    expect(normalizarInstagram("https://www.instagram.com/tavarescoach/?hl=pt")).toBe("@tavarescoach");
    expect(normalizarInstagram("nome com espaço")).toBeNull();
    expect(normalizarInstagram("")).toBeNull();
  });

  it("frase muda com a sequência", () => {
    expect(fraseDaOfensiva(1)).toBe("O 1º de muitos");
    expect(fraseDaOfensiva(7)).toBe("Uma semana inteira");
  });
});

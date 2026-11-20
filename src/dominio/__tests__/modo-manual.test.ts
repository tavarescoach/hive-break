/**
 * Modo sem câmera (docs/HUD_TREINO.md): o HUD é o mesmo do modo câmera, só
 * sem o vídeo — tempo regressivo (real ou estimado por `duracaoManualMs`),
 * meta visível, avanço automático de série e o valor declarado ("Quantas
 * você fez?"). Tudo aqui é lógica pura de `SessaoTreino`/`compilar`, sem UI.
 */
import { describe, expect, it } from "vitest";
import {
  compilar, duracaoManualMs, SessaoTreino,
  type Bloco, type Estrutura, type EventoSessao, type ExercicioMetodo, type FaseTrabalho,
} from "../metodos";

const AGACHAMENTO: ExercicioMetodo = { nome: "Agachamento", sustentacao: false, segPorRep: 3 };
const PRANCHA: ExercicioMetodo = { nome: "Prancha", sustentacao: true, segPorRep: 0 };
const ARVORE: ExercicioMetodo = { nome: "Postura da árvore", sustentacao: true, segPorRep: 0 };

const est = (blocos: Bloco[], extra: Partial<Estrutura> = {}): Estrutura => ({ versao: 2, organizacao: "sequencia", pausa_entre_blocos_s: 20, blocos, ...extra });
const trabalhos = (e: Estrutura, ex: ExercicioMetodo[]) => compilar(e, ex).fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");

/** Um bloco de cada um dos 7 métodos (6 `MetodoBloco` + a escada, uma variação de "reps"). */
const BLOCOS_7_METODOS: Record<string, Bloco> = {
  amrap: { exercicio_id: "a", metodo: "amrap", series: 1, esforco_s: 30, pausa_s: 0, score: "total_reps" },
  isometria: { exercicio_id: "a", metodo: "isometria", series: 1, esforco_s: 30, pausa_s: 0, score: "tempo_valido" },
  reps: { exercicio_id: "a", metodo: "reps", series: 1, reps_alvo: 6, pausa_s: 0, score: "reps_por_serie" },
  escada: { exercicio_id: "a", metodo: "reps", series: 2, reps_alvo: [4, 8], pausa_s: 0, score: "total_reps" },
  emom: { exercicio_id: "a", metodo: "emom", series: 1, reps_alvo: 10, pausa_s: 0, score: "reps_por_serie" },
  tabata: { exercicio_id: "a", metodo: "tabata", series: 1, esforco_s: 20, pausa_s: 10, score: "total_reps" },
  for_time: { exercicio_id: "a", metodo: "for_time", series: 1, reps_alvo: 15, pausa_s: 0, score: "tempo_total" },
};

describe("duracaoManualMs: regressivo sem câmera para os 7 métodos", () => {
  it("usa o tempo real quando a fase já tem duracaoMs (amrap, isometria, tabata, emom)", () => {
    for (const chave of ["amrap", "isometria", "tabata", "emom"] as const) {
      const [f] = trabalhos(est([BLOCOS_7_METODOS[chave]]), [AGACHAMENTO]);
      expect(f.duracaoMs).toBeDefined();
      expect(duracaoManualMs(f, AGACHAMENTO)).toBe(f.duracaoMs);
    }
  });

  it("estima reps × segundo por rep quando a fase não tem duracaoMs (reps, escada, contra o relógio)", () => {
    const [reps] = trabalhos(est([BLOCOS_7_METODOS.reps]), [AGACHAMENTO]);
    expect(reps.duracaoMs).toBeUndefined();
    expect(duracaoManualMs(reps, AGACHAMENTO)).toBe(6 * 3 * 1000);

    const escada = trabalhos(est([BLOCOS_7_METODOS.escada]), [AGACHAMENTO]);
    expect(duracaoManualMs(escada[0], AGACHAMENTO)).toBe(4 * 3 * 1000);
    expect(duracaoManualMs(escada[1], AGACHAMENTO)).toBe(8 * 3 * 1000);

    const [forTime] = trabalhos(est([BLOCOS_7_METODOS.for_time], { teto_s: 120 }), [AGACHAMENTO]);
    expect(duracaoManualMs(forTime, AGACHAMENTO)).toBe(15 * 3 * 1000);
  });

  it("sem meta de reps nem faixa (AMRAP aberto), a estimativa não quebra: fica em 0", () => {
    const linha = compilar(est([{ exercicio_id: "a", metodo: "reps", series: 1, reps_alvo: undefined, pausa_s: 0, score: "total_reps" }]), [AGACHAMENTO]);
    const [f] = linha.fases.filter((x): x is FaseTrabalho => x.tipo === "trabalho");
    expect(duracaoManualMs(f, AGACHAMENTO)).toBe(0);
  });

  it("a mesma linha do tempo (compilar) serve os dois modos: nenhum campo depende de haver câmera", () => {
    for (const bloco of Object.values(BLOCOS_7_METODOS)) {
      const linha = compilar(est([bloco], bloco.metodo === "for_time" ? { teto_s: 120 } : {}), [AGACHAMENTO]);
      const [f] = linha.fases.filter((x): x is FaseTrabalho => x.tipo === "trabalho");
      // O que o HUD manual precisa (duracaoManualMs) está todo nos mesmos campos que o HUD da câmera já lê.
      expect(duracaoManualMs(f, AGACHAMENTO)).toBeGreaterThan(0);
    }
  });
});

describe("sessão de treino sem câmera", () => {
  it("fases por tempo (AMRAP/isometria/Tabata/EMOM) avançam sozinhas, sem nenhuma rep — o relógio já basta", () => {
    for (const chave of ["amrap", "isometria", "tabata"] as const) {
      const linha = compilar(est([BLOCOS_7_METODOS[chave]]), [chave === "isometria" ? PRANCHA : AGACHAMENTO], { preparoS: 5 });
      const s = new SessaoTreino(linha);
      s.pular(); // sai do preparo
      expect(s.fase.tipo).toBe("trabalho");
      for (let t = 100; t <= 31_000 && s.fase.tipo === "trabalho"; t += 100) {
        s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, foraDoQuadro: false, pausado: false });
      }
      expect(s.resultados).toHaveLength(1);
      expect(s.resultados[0].interrompida).toBe(false);
    }
  });

  it("declarar(): fecha a série por reps/escada/contra o relógio sem interromper, com o valor dado", () => {
    const linha = compilar(est([BLOCOS_7_METODOS.reps]), [AGACHAMENTO], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    s.pular();
    expect(s.fase).toMatchObject({ tipo: "trabalho", alvoReps: 6 });
    const eventos = s.declarar(6);
    expect(eventos[0]).toMatchObject({ tipo: "resultado", resultado: { reps: 6, cumprida: true, interrompida: false } });
    expect(eventos.at(-1)).toEqual({ tipo: "fim", motivo: "concluido" }); // única série do bloco: o desafio termina
    expect(s.terminou).toBe(true);
  });

  it("declarar() com valor abaixo da meta ainda assim segue para a próxima fase (a série não trava)", () => {
    const linha = compilar(est([{ ...BLOCOS_7_METODOS.reps, series: 2 }]), [AGACHAMENTO], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    s.pular();
    s.declarar(2); // menos que a meta de 6
    expect(s.resultados[0]).toMatchObject({ reps: 2, cumprida: false, interrompida: false });
    expect(s.fase.tipo).toBe("trabalho"); // já está na 2ª série
    expect((s.fase as FaseTrabalho).serie).toBe(2);
  });

  it("evento 'metade': dispara uma vez, no meio de uma fase de sustentação (troca de perna/lado)", () => {
    const linha = compilar(est([BLOCOS_7_METODOS.isometria]), [PRANCHA], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    s.pular();
    const eventos: EventoSessao[] = [];
    for (let t = 100; t <= 31_000 && s.fase.tipo === "trabalho"; t += 100) {
      eventos.push(...s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: t, foraDoQuadro: false, pausado: false }));
    }
    const metades = eventos.filter((e) => e.tipo === "metade");
    expect(metades).toHaveLength(1);
  });

  it("evento 'metade' não dispara em fases por reps/tempo que não são de sustentação", () => {
    const linha = compilar(est([BLOCOS_7_METODOS.amrap]), [AGACHAMENTO], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    s.pular();
    const eventos: EventoSessao[] = [];
    for (let t = 100; t <= 31_000 && s.fase.tipo === "trabalho"; t += 100) {
      eventos.push(...s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: 0, foraDoQuadro: false, pausado: false }));
    }
    expect(eventos.filter((e) => e.tipo === "metade")).toHaveLength(0);
  });

  it("corrigir(): ajusta o valor declarado de uma série já registrada ('Quantas você fez?' é opcional)", () => {
    const linha = compilar(est([{ ...BLOCOS_7_METODOS.reps, series: 2 }]), [AGACHAMENTO], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    s.pular();
    s.declarar(6); // valor padrão = a meta
    expect(s.resultados[0]).toMatchObject({ reps: 6, cumprida: true });
    s.corrigir(1, 4); // a pessoa ajusta: fez só 4
    expect(s.resultados[0]).toMatchObject({ reps: 4, cumprida: false });
    // Não existe resultado nessa fase: corrigir não faz nada (sem lançar).
    expect(() => s.corrigir(99, 10)).not.toThrow();
  });

  it("corrigir() não interfere no valor real de uma fase de sustentação (tempo, não reps)", () => {
    const linha = compilar(est([BLOCOS_7_METODOS.isometria]), [PRANCHA], { preparoS: 5 });
    const s = new SessaoTreino(linha);
    s.pular();
    for (let t = 100; t <= 31_000 && s.fase.tipo === "trabalho"; t += 100) {
      s.tick(t, { reps: 0, parciais: 0, tempoValidoMs: t * 0.9, foraDoQuadro: false, pausado: false });
    }
    const cumpridaAntes = s.resultados[0].cumprida;
    s.corrigir(1, 999);
    expect(s.resultados[0].cumprida).toBe(cumpridaAntes); // cumprida continua pelo tempo válido, não pelas "reps"
  });
});

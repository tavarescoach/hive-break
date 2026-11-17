import { describe, expect, it } from "vitest";
import type { Kpis } from "@/motor/tipos";
import { agregarPorExercicio } from "../agregar";
import type { ResultadoFase } from "../metodos";

const r = (fase: number, exercicio: number, reps: number, duracaoMs: number, extra: Partial<ResultadoFase> = {}): ResultadoFase => ({
  fase, exercicio, reps, parciais: 0, tempoValidoMs: 0, duracaoMs, cumprida: true, interrompida: false, ...extra,
});
const k = (v: Partial<Kpis>) => v as Kpis;

describe("números enviados ao servidor", () => {
  it("soma por exercício, faz médias ponderadas pelo tempo e anexa os números do método", () => {
    const resultados = [r(1, 0, 10, 20_000), r(3, 1, 8, 20_000, { cumprida: false }), r(5, 0, 6, 20_000, { parciais: 2 })];
    const kpis = new Map([
      [1, k({ amplitude_media: 0.8, fora_quadro_pct: 0, reps_rapidas: 1 })],
      [3, k({ amplitude_media: 0.5, fora_quadro_pct: 10 })],
      [5, k({ amplitude_media: 0.4, fora_quadro_pct: 20 })],
    ]);
    const blocos = agregarPorExercicio([1, 2], resultados, kpis, { pior_round: 6 });
    expect(blocos).toHaveLength(2);
    expect(blocos[0]).toMatchObject({ ordem: 1, reps_validas: 16, reps_parciais: 2, fora_quadro_pct: 10 });
    expect(blocos[0].kpis).toMatchObject({ amplitude_media: 0.6, cadencia: 24, fases: 2, fases_cumpridas: 2, reps_rapidas: 1, metodo_pior_round: 6 });
    expect(blocos[1]).toMatchObject({ ordem: 2, reps_validas: 8, fora_quadro_pct: 10 });
    expect(blocos[1].kpis.fases_cumpridas).toBe(0);
    expect("metodo_pior_round" in blocos[1].kpis).toBe(false);
  });

  it("exercício sem nenhuma fase feita não gera bloco; sustentação manda o tempo", () => {
    const blocos = agregarPorExercicio([1, 2], [r(1, 1, 0, 30_000, { tempoValidoMs: 27_500 })], new Map(), {});
    expect(blocos).toEqual([expect.objectContaining({ ordem: 2, reps_validas: 0, tempo_valido_s: 27.5 })]);
    expect(blocos[0].kpis.cadencia).toBeNull();
  });
});

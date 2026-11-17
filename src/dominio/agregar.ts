/**
 * Junta os números de cada fase de trabalho num registro por exercício do
 * desafio: é o que vai para o servidor (só números, nunca imagem ou pontos).
 */
import type { Kpis } from "../motor/tipos";
import type { ResultadoFase } from "./metodos";

export interface BlocoEnviado {
  ordem: number;
  reps_validas: number;
  reps_parciais: number;
  tempo_valido_s: number;
  fora_quadro_pct: number;
  kpis: Record<string, number | null>;
}

/** KPIs que viram média ponderada pelo tempo de cada fase. */
const MEDIAS = ["amplitude_media", "regularidade", "indice_tecnico", "estabilidade", "simetria", "pct_tempo_valido", "precisao", "tempo_reacao", "tempo_excentrico", "tempo_concentrico"] as const;

const arred = (v: number, casas = 3) => Math.round(v * 10 ** casas) / 10 ** casas;

/**
 * @param ordens ordem de cada exercício no desafio (índice do exercício → ordem do bloco)
 * @param resultados resultado de cada fase de trabalho
 * @param kpisPorFase KPIs do motor ao fim de cada fase (índice da fase → KPIs)
 * @param numerosMetodo números do método (Tabata, EMOM...), anexados ao primeiro bloco
 */
export function agregarPorExercicio(
  ordens: number[],
  resultados: ResultadoFase[],
  kpisPorFase: Map<number, Kpis>,
  numerosMetodo: Record<string, number>,
): BlocoEnviado[] {
  const blocos: BlocoEnviado[] = [];
  ordens.forEach((ordem, exercicio) => {
    const fases = resultados.filter((r) => r.exercicio === exercicio);
    if (fases.length === 0) return;
    const duracaoMs = fases.reduce((s, r) => s + r.duracaoMs, 0);
    const reps = fases.reduce((s, r) => s + r.reps, 0);
    const kpis: Record<string, number | null> = {};
    for (const nome of MEDIAS) {
      let soma = 0;
      let peso = 0;
      for (const r of fases) {
        const v = kpisPorFase.get(r.fase)?.[nome];
        if (typeof v === "number" && Number.isFinite(v)) {
          soma += v * Math.max(1, r.duracaoMs);
          peso += Math.max(1, r.duracaoMs);
        }
      }
      kpis[nome] = peso > 0 ? arred(soma / peso) : null;
    }
    let foraPeso = 0;
    for (const r of fases) foraPeso += (kpisPorFase.get(r.fase)?.fora_quadro_pct ?? 0) * r.duracaoMs;
    kpis.cadencia = duracaoMs > 0 && reps > 0 ? arred(reps / (duracaoMs / 60000), 1) : null;
    kpis.fases = fases.length;
    kpis.fases_cumpridas = fases.filter((r) => r.cumprida).length;
    kpis.tempo_trabalho_s = arred(duracaoMs / 1000, 1);
    kpis.reps_rapidas = fases.reduce((s, r) => s + (kpisPorFase.get(r.fase)?.reps_rapidas ?? 0), 0);
    blocos.push({
      ordem,
      reps_validas: reps,
      reps_parciais: fases.reduce((s, r) => s + r.parciais, 0),
      tempo_valido_s: arred(fases.reduce((s, r) => s + r.tempoValidoMs, 0) / 1000, 1),
      fora_quadro_pct: duracaoMs > 0 ? arred(foraPeso / duracaoMs, 1) : 0,
      kpis,
    });
  });
  if (blocos.length > 0) {
    for (const [nome, valor] of Object.entries(numerosMetodo)) blocos[0].kpis[`metodo_${nome}`] = valor;
  }
  return blocos;
}

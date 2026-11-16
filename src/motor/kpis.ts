import { desvioPadrao, limitar, media } from "./geometria";
import type { Kpis, RegistroRep } from "./tipos";

/** Tudo o que o motor acumulou num bloco. Só números: nada de imagem ou pontos. */
export interface ResumoBloco {
  reps: RegistroRep[];
  repsRapidas: number;
  tempoTrabalhoMs: number;
  tempoForaMs: number;
  tempoValidoMs: number;
  tempoValidoLadoMs: { e: number; d: number };
  maiorSustentacaoMs: number;
  perdasPosicao: number;
  /** Oscilação média do ponto de controle (já normalizada), ou null. */
  oscilacao: number | null;
  /** Oscilação que zera a estabilidade (da definição). */
  oscilacaoMaxima: number | null;
  /** Contagem de ocorrências por erro. */
  erros: Record<string, number>;
}

const arredondar = (valor: number, casas = 3) => {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
};

const ouNulo = (valor: number, casas = 3) => (Number.isFinite(valor) ? arredondar(valor, casas) : null);

/** Calcula os KPIs da seção 8.3 a partir do resumo do bloco. */
export function calcularKpis(r: ResumoBloco): Kpis {
  const validas = r.reps.filter((rep) => rep.valida);
  const parciais = r.reps.filter((rep) => !rep.valida);
  const tempoAtivoMs = Math.max(0, r.tempoTrabalhoMs - r.tempoForaMs);

  const amplitudes = validas.map((rep) => rep.amplitude).filter((a): a is number => a !== null);
  const idas = validas.map((rep) => rep.tempoIdaMs / 1000);
  const voltas = validas.map((rep) => rep.tempoVoltaMs / 1000);

  // Regularidade: 1 menos o coeficiente de variação do intervalo entre reps.
  let regularidade: number | null = null;
  if (validas.length >= 3) {
    const intervalos = validas.slice(1).map((rep, i) => rep.t - validas[i].t);
    const m = media(intervalos);
    if (m > 0) regularidade = arredondar(limitar(1 - desvioPadrao(intervalos) / m, 0, 1));
  }

  const comErro = validas.filter((rep) => rep.erros.length > 0).length;
  const { e, d } = r.tempoValidoLadoMs;

  let estabilidade: number | null = null;
  if (r.oscilacao !== null && r.oscilacaoMaxima) {
    estabilidade = arredondar(limitar(1 - r.oscilacao / r.oscilacaoMaxima, 0, 1));
  }

  return {
    reps_validas: validas.length,
    reps_parciais: parciais.length,
    reps_rapidas: r.repsRapidas,
    amplitude_media: amplitudes.length ? ouNulo(media(amplitudes)) : null,
    tempo_excentrico: idas.length ? ouNulo(media(idas), 2) : null,
    tempo_concentrico: voltas.length ? ouNulo(media(voltas), 2) : null,
    tempo_sob_tensao: validas.length ? ouNulo(validas.reduce((s, rep) => s + rep.duracaoMs, 0) / 1000, 1) : null,
    cadencia: validas.length && tempoAtivoMs > 0 ? ouNulo(validas.length / (tempoAtivoMs / 60000), 1) : null,
    regularidade,
    indice_tecnico: validas.length ? arredondar(1 - comErro / validas.length) : null,
    tempo_valido_s: arredondar(r.tempoValidoMs / 1000, 1),
    tempo_valido_e_s: arredondar(e / 1000, 1),
    tempo_valido_d_s: arredondar(d / 1000, 1),
    maior_sustentacao_s: arredondar(r.maiorSustentacaoMs / 1000, 1),
    oscilacao: r.oscilacao === null ? null : arredondar(r.oscilacao, 4),
    estabilidade,
    simetria: e > 0 && d > 0 ? arredondar(Math.min(e, d) / Math.max(e, d)) : null,
    perdas_posicao: r.perdasPosicao,
    tempo_trabalho_s: arredondar(r.tempoTrabalhoMs / 1000, 1),
    fora_quadro_pct: r.tempoTrabalhoMs > 0 ? arredondar((100 * r.tempoForaMs) / r.tempoTrabalhoMs, 1) : 0,
    erros: { ...r.erros },
  };
}

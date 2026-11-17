/**
 * Dados do card de compartilhamento da tela final (código puro, sem DOM).
 *
 * Regra "ninguém é exposto": o card mostra só números do próprio treino. Nunca
 * peso, medidas, calorias nem posição individual em ranking. O que vem da hive
 * é sempre um total anônimo ("6 de 8 da hive já fizeram hoje").
 * Dado que o app ainda não tem fica `null` e o item some do card.
 */

import type { FaseTrabalho, LinhaDoTempo, ResultadoFase, Score } from "./metodos";
import { formatarTempo } from "./metodos";

/** Como o bloco é medido no card: repetições, segundos válidos ou tempo para completar. */
export type TipoScoreCard = "reps" | "segundos" | "tempo";

export interface BlocoCard {
  /** Posição do bloco no desafio. */
  indice: number;
  exercicio: string;
  tipo: TipoScoreCard;
  /** Valor principal, já formatado ("62", "45", "3:12"). */
  valor: string;
  /** Unidade embaixo do valor ("reps", "s válidos", "para completar"). */
  unidade: string;
  /** Uma marca por série, ex.: "14·13·12·12·11". Vazio quando só houve uma série. */
  series: string;
  /** Valor numérico, para comparar com o recorde (reps ou segundos). */
  numero: number;
}

export interface RecordeCard {
  /** "Seu recorde: 62 reps" (já inclui o treino de hoje). */
  texto: string;
  /** Bateu o recorde anterior neste treino. */
  novo: boolean;
}

export interface DadosCard {
  ofensiva: number;
  /** "dia" ou "dias seguidos". */
  rotuloOfensiva: string;
  /** Frase de apoio da ofensiva, ex.: "O 1º de muitos". */
  fraseOfensiva: string;
  blocos: BlocoCard[];
  recorde: RecordeCard | null;
  /** "6 de 8 da hive já fizeram hoje". */
  hive: string | null;
  /** "Esforço 7 de 10". */
  pse: string | null;
  usuario: string;
  /** Com "@" na frente; null quando o perfil não tem. */
  instagram: string | null;
  desafio: string;
  modalidade: string;
  /** "17 nov 2026 · 19:42". */
  quando: string;
}

/**
 * Melhores marcas anteriores do usuário neste desafio (só tentativas com câmera),
 * por posição do bloco. Objeto vazio: nunca fez com câmera. null: não deu para ler.
 */
export type RecordesAnteriores = Record<number, { reps: number; segundos: number }>;

export function tipoDoScore(score: Score): TipoScoreCard {
  if (score === "tempo_valido") return "segundos";
  if (score === "tempo_total") return "tempo";
  return "reps";
}

/** Um bloco por exercício, no tipo de score do método. */
export function blocosDoCard(linha: LinhaDoTempo, resultados: ResultadoFase[], nomes: string[]): BlocoCard[] {
  return linha.estrutura.blocos.flatMap((bloco, i): BlocoCard[] => {
    const series = resultados.filter((r) => r.exercicio === i);
    if (series.length === 0) return [];
    // Sustentação conta tempo mesmo se o bloco foi cadastrado com outro score.
    const sustentar = series.some((r) => (linha.fases[r.fase] as FaseTrabalho | undefined)?.sustentar);
    const tipo: TipoScoreCard = sustentar ? "segundos" : tipoDoScore(bloco.score);
    const marcas = (valores: (number | string)[]) => (valores.length > 1 ? valores.join("·") : "");
    if (tipo === "segundos") {
      const seg = series.map((r) => Math.round(r.tempoValidoMs / 1000));
      const total = seg.reduce((s, v) => s + v, 0);
      return [{ indice: i, exercicio: nomes[i] ?? bloco.exercicio_id, tipo, valor: String(total), unidade: "s válidos", series: marcas(seg), numero: total }];
    }
    if (tipo === "tempo") {
      const total = series.reduce((s, r) => s + r.duracaoMs, 0) / 1000;
      return [{
        indice: i,
        exercicio: nomes[i] ?? bloco.exercicio_id,
        tipo,
        valor: formatarTempo(total),
        unidade: "para completar",
        series: marcas(series.map((r) => formatarTempo(r.duracaoMs / 1000))),
        numero: Math.round(total),
      }];
    }
    const reps = series.map((r) => r.reps);
    const total = reps.reduce((s, v) => s + v, 0);
    return [{ indice: i, exercicio: nomes[i] ?? bloco.exercicio_id, tipo, valor: String(total), unidade: total === 1 ? "rep" : "reps", series: marcas(reps), numero: total }];
  });
}

/**
 * Recorde pessoal do desafio, no primeiro bloco com marca comparável (reps ou
 * segundos válidos; tempo para completar ainda não é guardado por bloco).
 * Sempre "Seu recorde: X" (X já inclui o treino de hoje); `novo` quando bateu
 * uma marca anterior. Sem dado (modo sem câmera, erro de leitura): null.
 */
export function recordeDoCard(linha: LinhaDoTempo, resultados: ResultadoFase[], nomes: string[], anteriores: RecordesAnteriores | null): RecordeCard | null {
  if (!anteriores) return null;
  const blocos = blocosDoCard(linha, resultados, nomes).filter((b) => b.tipo !== "tempo" && b.numero > 0);
  const bloco = blocos[0];
  if (!bloco) return null;
  const marca = anteriores[bloco.indice];
  const antes = marca ? (bloco.tipo === "segundos" ? marca.segundos : marca.reps) : 0;
  const melhor = Math.max(antes, bloco.numero);
  const unidade = bloco.tipo === "segundos" ? "s" : melhor === 1 ? "rep" : "reps";
  const nome = linha.estrutura.blocos.length > 1 ? ` em ${bloco.exercicio.toLowerCase()}` : "";
  return { texto: `Seu recorde${nome}: ${melhor} ${unidade}`, novo: antes > 0 && bloco.numero > antes };
}

export function fraseDaOfensiva(dias: number): string {
  if (dias <= 1) return "O 1º de muitos";
  if (dias === 2) return "Já virou dupla";
  if (dias < 7) return "Pegando ritmo";
  if (dias === 7) return "Uma semana inteira";
  if (dias < 30) return "Hábito em construção";
  if (dias === 30) return "Um mês sem parar";
  if (dias < 100) return "Já faz parte do dia";
  return "Constância de verdade";
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatarQuando(data: Date): string {
  const hh = String(data.getHours()).padStart(2, "0");
  const mm = String(data.getMinutes()).padStart(2, "0");
  return `${data.getDate()} ${MESES[data.getMonth()]} ${data.getFullYear()} · ${hh}:${mm}`;
}

/** Aceita "fulano", "@fulano" ou o link do perfil e devolve "@fulano". */
export function normalizarInstagram(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpo = valor.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/[/?#].*$/, "").replace(/^@+/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(limpo) ? `@${limpo}` : null;
}

export interface EntradaCard {
  linha: LinhaDoTempo;
  resultados: ResultadoFase[];
  nomes: string[];
  ofensiva: number;
  recordesAnteriores: RecordesAnteriores | null;
  /** Ainda não existe na trilha principal: sempre null por enquanto. */
  hive: { fizeram: number; total: number } | null;
  pse: number | null;
  usuario: string;
  instagram: string | null;
  desafio: string;
  modalidade: string;
  quando: Date;
}

export function montarDadosCard(e: EntradaCard): DadosCard {
  const dias = Math.max(1, e.ofensiva);
  return {
    ofensiva: dias,
    rotuloOfensiva: dias === 1 ? "dia" : "dias seguidos",
    fraseOfensiva: fraseDaOfensiva(dias),
    blocos: blocosDoCard(e.linha, e.resultados, e.nomes),
    recorde: recordeDoCard(e.linha, e.resultados, e.nomes, e.recordesAnteriores),
    hive: e.hive && e.hive.total > 1 ? `${e.hive.fizeram} de ${e.hive.total} da hive já fizeram hoje` : null,
    pse: e.pse !== null && e.pse >= 1 && e.pse <= 10 ? `Esforço ${e.pse} de 10` : null,
    usuario: e.usuario,
    instagram: normalizarInstagram(e.instagram),
    desafio: e.desafio,
    modalidade: e.modalidade,
    quando: formatarQuando(e.quando),
  };
}

/** Hive ao vivo: tipos e regras que a tela usa (banco em supabase/migrations/*_hive.sql). */

export type StatusHive = "sala" | "andamento" | "encerrada";

/** `saiu` existe no banco (abandono explícito), mas nenhuma tela ainda escreve nele. */
export type StatusParticipanteHive = "ativo" | "concluiu" | "saiu" | "parou_justificado";
export type MotivoParada = "dor" | "compromisso";

export interface ParticipanteHive {
  id: string;
  apelido: string;
  avatar_url: string | null;
  atrasado: boolean;
  concluido: boolean;
  modo: "camera" | "manual" | null;
  xp: number | null;
  reps: number | null;
  tempo_valido_s: number | null;
  status: StatusParticipanteHive;
  motivo_parada: MotivoParada | null;
  xp_base: number | null;
  xp_bonus_tamanho: number;
  xp_bonus_completa: number;
}

/** O que ler_hive e listar_hives devolvem para cada hive. */
export interface DadosHive {
  id: string;
  status: StatusHive;
  inicio_em: string;
  fim_em: string;
  modo_competicao: boolean;
  anfitriao_id: string;
  anfitriao: string | null;
  challenge_id: string;
  desafio: string;
  modalidade: string;
  duracao_s: number;
  sou_participante: boolean;
  amigo: boolean;
  participantes: ParticipanteHive[];
  /** Quantos concluíram contando pro bônus (câmera, ≤30% fora do quadro). */
  n_concluiram: number;
  /** Bônus por tamanho (seção 3 de docs/BONUS_HIVE.md), em %. 0 enquanto ninguém concluiu. */
  bonus_tamanho_pct: number;
  /** Todo mundo que entrou (menos quem se justificou) concluiu, com 4+ pessoas na hive. */
  completa: boolean;
  /** Janela de resgate de 30 min: até quando dá pra fechar como completa. null = sem janela aberta. */
  janela_ate: string | null;
  /** A hive já fechou de vez (bônus já creditados). */
  fechada_em: string | null;
  /** Só em ler_hive: estado do desafio na trilha de quem está vendo. */
  estado_desafio?: string | null;
}

/** Teto do bônus por tamanho (seção 3), sem contar o bônus de hive completa. */
export const BONUS_TAMANHO_TETO = 60;
/** Bônus extra de hive completa (seção 4.1): só com 4+ pessoas na hive. */
export const BONUS_COMPLETA_PCT = 20;
export const BONUS_COMPLETA_MINIMO_PESSOAS = 4;

/**
 * Bônus por tamanho da hive (seção 3): `min(60, round(18,5·ln(n) − 2,8))` pra
 * n ≥ 2 pessoas que concluíram; com 1 (ou 0), não tem bônus. Espelha
 * `hive_bonus_tamanho_pct` no banco — os dois precisam bater.
 */
export function bonusPorTamanho(n: number): number {
  if (n < 2) return 0;
  return Math.min(BONUS_TAMANHO_TETO, Math.round(18.5 * Math.log(n) - 2.8));
}

/** Estado ao vivo de cada pessoa, publicado no canal Realtime da hive. Só números. */
export type EtapaAoVivo = "sala" | "preparo" | "serie" | "pausa" | "terminou";

export interface PresencaHive {
  id: string;
  apelido: string;
  avatar_url: string | null;
  etapa: EtapaAoVivo;
  serie: number;
  total: number;
  reps: number;
}

export const ROTULO_ETAPA: Record<EtapaAoVivo, string> = {
  sala: "pronto",
  preparo: "preparo",
  serie: "série",
  pausa: "pausa",
  terminou: "terminou",
};

/** Segundos que faltam até o horário (arredondado para cima, nunca negativo). */
export function segundosAte(iso: string, agora = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - agora) / 1000));
}

export function relogio(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Texto do convite para o WhatsApp. */
export function textoConviteHive(hive: Pick<DadosHive, "desafio" | "duracao_s">, link: string): string {
  const minutos = Math.max(1, Math.round(hive.duracao_s / 60));
  return `Bora um break de ${minutos} min? Entra na minha hive de ${hive.desafio} no Hive Break: ${link}`;
}

/**
 * Ordem do card coletivo: quem terminou primeiro; no modo competição, por reps
 * (e por tempo válido, nos desafios de sustentação).
 */
export function ordenarResultado(participantes: ParticipanteHive[], competicao: boolean): ParticipanteHive[] {
  if (!competicao) return [...participantes].sort((a, b) => Number(b.concluido) - Number(a.concluido));
  return [...participantes].sort(
    (a, b) =>
      Number(b.concluido) - Number(a.concluido) ||
      (b.reps ?? 0) - (a.reps ?? 0) ||
      (b.tempo_valido_s ?? 0) - (a.tempo_valido_s ?? 0),
  );
}

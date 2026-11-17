/** Hive ao vivo: tipos e regras que a tela usa (banco em supabase/migrations/*_hive.sql). */

export type StatusHive = "sala" | "andamento" | "encerrada";

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
  /** Só em ler_hive: estado do desafio na trilha de quem está vendo. */
  estado_desafio?: string | null;
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

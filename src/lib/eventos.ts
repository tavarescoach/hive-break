"use client";

import { criarClienteNavegador } from "@/lib/supabase/navegador";

/** Nomes aceitos pela função registrar_evento (migração 20261126000400_eventos.sql). */
export type NomeEvento =
  | "ftue_aberto"
  | "comecar_tocado"
  | "declaracao_aceita"
  | "camera_permitida"
  | "camera_negada"
  | "preparo_iniciado"
  | "primeira_rep"
  | "desafio_concluido";

const CHAVE_FTUE_ABERTO = "hb_ftue_aberto_em";
const CHAVE_PRIMEIRA_REP = "hb_primeira_rep_registrada";

/** Marca o instante da abertura (landing), para medir ms até a 1ª rep. Idempotente na aba. */
export function marcarFtueAberto(): void {
  try {
    if (!sessionStorage.getItem(CHAVE_FTUE_ABERTO)) sessionStorage.setItem(CHAVE_FTUE_ABERTO, String(Date.now()));
  } catch {
    // Sem sessionStorage (modo privado ou bloqueado): segue sem medir.
  }
}

function msDesdeFtueAberto(): number | null {
  try {
    const t = sessionStorage.getItem(CHAVE_FTUE_ABERTO);
    return t ? Date.now() - Number(t) : null;
  } catch {
    return null;
  }
}

/**
 * Registra um evento de produto (eventos, migração 20261126000400_eventos.sql).
 * Nunca lança: uma falha de rede ou de permissão aqui não pode travar a tela.
 */
export function registrarEvento(nome: NomeEvento, props: Record<string, unknown> = {}): void {
  criarClienteNavegador()
    .rpc("registrar_evento", { p_nome: nome, p_props: props })
    .then(
      () => {},
      () => {},
    );
}

/** `primeira_rep`: só a primeira vez por aba, com os ms desde `ftue_aberto`. */
export function registrarPrimeiraRepSeNecessario(exercicioId: string): void {
  try {
    if (sessionStorage.getItem(CHAVE_PRIMEIRA_REP)) return;
    sessionStorage.setItem(CHAVE_PRIMEIRA_REP, "1");
  } catch {
    // Sem sessionStorage: registra mesmo assim (melhor duas vezes que nenhuma).
  }
  registrarEvento("primeira_rep", { exercicio_id: exercicioId, ms_desde_ftue_aberto: msDesdeFtueAberto() });
}

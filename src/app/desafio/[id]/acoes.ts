"use server";

import { revalidatePath } from "next/cache";
import { exigirCadastroCompleto } from "@/lib/sessao";

/** Números de um exercício do desafio, medidos no aparelho. Nunca imagem ou vídeo. */
export interface BlocoEnviado {
  ordem: number;
  reps_validas: number;
  reps_parciais: number;
  tempo_valido_s: number;
  fora_quadro_pct: number;
  kpis: Record<string, number | null>;
}

export interface ResultadoDesafio {
  ok: boolean;
  erro?: string;
  xp?: number;
  modo?: "camera" | "manual";
  sem_movimento?: boolean;
  primeiro_do_dia?: boolean;
  refeito?: boolean;
  refazer_sem_xp?: boolean;
  ofensiva?: number;
  unidade_concluida?: boolean;
  unidade_sessao?: boolean;
  nivel_concluido?: boolean;
  proximo_nivel?: number | null;
}

const REGIOES = ["joelho", "ombro", "lombar", "punho", "quadril", "tornozelo", "pescoco", "outra"];

/**
 * Fecha o desafio. O servidor confere se ele está liberado, valida os números
 * e calcula XP, ofensiva e o que foi liberado.
 */
export async function finalizarDesafio(id: string, modo: "camera" | "manual", blocos: BlocoEnviado[]): Promise<ResultadoDesafio> {
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("finalizar_desafio", {
    p_challenge_id: id,
    p_modo: modo,
    p_blocos: modo === "camera" ? blocos : [],
  });
  if (error) {
    return {
      ok: false,
      erro: error.message.includes("desafio_bloqueado")
        ? "Este desafio ainda está bloqueado. Volte à trilha e faça os anteriores."
        : "Não consegui registrar. Confira a internet e tente de novo.",
    };
  }
  revalidatePath("/trilha");
  return { ok: true, ...(data as Omit<ResultadoDesafio, "ok">) };
}

/** Botão "Senti dor": registra a região e encerra o desafio (seção 12.4). */
export async function registrarDor(id: string, exercicio: string, regiao: string): Promise<{ ok: boolean }> {
  if (!REGIOES.includes(regiao)) return { ok: false };
  const sessao = await exigirCadastroCompleto();
  const { error } = await sessao.supabase.rpc("registrar_dor", { p_challenge_id: id, p_exercise_id: exercicio, p_regiao: regiao });
  return { ok: !error };
}

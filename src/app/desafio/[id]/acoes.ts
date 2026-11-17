"use server";

import { revalidatePath } from "next/cache";
import { exigirCadastroCompleto } from "@/lib/sessao";

export interface ResultadoDesafio {
  ok: boolean;
  erro?: string;
  xp?: number;
  primeiro_do_dia?: boolean;
  repetido?: boolean;
  ofensiva?: number;
  unidade_concluida?: boolean;
  nivel_concluido?: boolean;
  proximo_nivel?: number | null;
}

/**
 * Modo provisório (sem câmera): a pessoa fez o desafio com o timer e tocou em
 * "Concluí". O servidor confere se o desafio está liberado e calcula XP,
 * ofensiva e o que foi liberado.
 */
export async function concluirDesafio(id: string): Promise<ResultadoDesafio> {
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("concluir_desafio_provisorio", { p_challenge_id: id });
  if (error) {
    return {
      ok: false,
      erro: error.message.includes("desafio_bloqueado")
        ? "Este desafio ainda está bloqueado. Volte à trilha e faça os anteriores."
        : "Não consegui registrar. Confira a internet e toque em Concluí de novo.",
    };
  }
  revalidatePath("/trilha");
  return { ok: true, ...(data as Omit<ResultadoDesafio, "ok">) };
}

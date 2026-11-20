"use server";

import { revalidatePath } from "next/cache";
import { exigirCadastroCompleto } from "@/lib/sessao";

export interface SerieParaSalvar {
  exercicio_id: string;
  tipo: "reps" | "tempo";
  pessoa: string;
  app_reps: number | null;
  prof_reps: number | null;
  app_tempo_s: number | null;
  prof_tempo_s: number | null;
  duracao_s: number;
  fps_medio: number | null;
  posicao_celular: string;
  serie_temporal: [number, number][];
  observacao: string;
}

/** /admin/calibracao: grava uma série (o banco recusa quem não está em ADMINS). */
export async function salvarSerie(serie: SerieParaSalvar): Promise<{ ok: boolean; mensagem: string }> {
  const sessao = await exigirCadastroCompleto();
  const { error } = await sessao.supabase.rpc("calibracao_registrar", { p: serie });
  if (error) return { ok: false, mensagem: error.message.includes("sem_permissao") ? "Sem permissão." : "Não deu para salvar. Tente de novo." };
  revalidatePath("/admin/calibracao");
  return { ok: true, mensagem: "Série salva." };
}

export async function apagarSerie(id: number): Promise<{ ok: boolean }> {
  const sessao = await exigirCadastroCompleto();
  const { error } = await sessao.supabase.rpc("calibracao_apagar", { p_id: id });
  revalidatePath("/admin/calibracao");
  return { ok: !error };
}

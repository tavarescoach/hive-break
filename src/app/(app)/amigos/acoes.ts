"use server";

import { exigirCadastroCompleto, exigirSessao } from "@/lib/sessao";

/** Convite enviado (compartilhou ou copiou o link): quem convida não recebe mais o A5. */
export async function registrarConviteEnviado(): Promise<void> {
  const sessao = await exigirCadastroCompleto();
  await sessao.supabase.rpc("registrar_evento_lembrete", { p_tipo: "invite_sent" });
}

/** High five no feed de amigos (docs/PERFIL.md, seção 3.3): 1 por pessoa por dia. */
export async function darHighFive(paraId: string): Promise<{ ok: boolean }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("dar_high_five", { p_para: paraId });
  return { ok: !error };
}

"use server";

import { exigirCadastroCompleto } from "@/lib/sessao";

/** Convite enviado (compartilhou ou copiou o link): quem convida não recebe mais o A5. */
export async function registrarConviteEnviado(): Promise<void> {
  const sessao = await exigirCadastroCompleto();
  await sessao.supabase.rpc("registrar_evento_lembrete", { p_tipo: "invite_sent" });
}

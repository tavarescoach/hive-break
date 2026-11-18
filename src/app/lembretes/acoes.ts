"use server";

import { revalidatePath } from "next/cache";
import { CATEGORIAS_LEMBRETE, type CategoriaLembrete } from "@/dominio/lembretes";
import { enviarAoN8n } from "@/lib/lembretes";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { criarClienteAnonimo } from "@/lib/supabase/anonimo";

const CAMPOS: string[] = [...CATEGORIAS_LEMBRETE.map((c) => c.campo), "push_ativo"];

export interface InscricaoPush {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

/** Guarda o aparelho depois que a pessoa aceitou a permissão do navegador. */
export async function salvarPush(inscricao: InscricaoPush, aparelho: string): Promise<{ ok: boolean }> {
  if (typeof inscricao?.endpoint !== "string" || !inscricao.keys?.p256dh || !inscricao.keys?.auth) return { ok: false };
  const sessao = await exigirCadastroCompleto();
  const { error } = await sessao.supabase.rpc("salvar_push", {
    p_endpoint: inscricao.endpoint,
    p_chaves: { p256dh: inscricao.keys.p256dh, auth: inscricao.keys.auth },
    p_aparelho: aparelho.slice(0, 120),
  });
  revalidatePath("/perfil/config");
  return { ok: !error };
}

/** Interruptor de uma categoria ou do push. Ligar uma categoria religa o e-mail. */
export async function salvarPreferencia(campo: CategoriaLembrete | "push_ativo", valor: boolean): Promise<{ ok: boolean }> {
  if (!CAMPOS.includes(campo) || typeof valor !== "boolean") return { ok: false };
  const sessao = await exigirCadastroCompleto();
  const dados: Record<string, boolean> = { [campo]: valor };
  if (valor && campo !== "push_ativo") dados.email_ativo = true;
  const { error } = await sessao.supabase.from("notification_preferences").update(dados).eq("user_id", sessao.usuarioId);
  revalidatePath("/perfil/config");
  return { ok: !error };
}

export async function desativarTodosLembretes(): Promise<{ ok: boolean }> {
  const sessao = await exigirCadastroCompleto();
  const { error } = await sessao.supabase
    .from("notification_preferences")
    .update({ lembrete: false, ofensiva: false, amigos: false, liga: false, resumo_semanal: false, email_ativo: false, push_ativo: false })
    .eq("user_id", sessao.usuarioId);
  revalidatePath("/perfil/config");
  return { ok: !error };
}

/** Link do rodapé do e-mail: sem login, vale o token assinado. */
export async function desativarPorToken(token: string, tudo: boolean): Promise<{ ok: boolean; categoria?: string }> {
  if (typeof token !== "string" || token.length > 200) return { ok: false };
  const { data, error } = await criarClienteAnonimo().rpc("desativar_lembretes", { p_token: token, p_tudo: tudo === true });
  if (error || !data) return { ok: false };
  return data as { ok: boolean; categoria?: string };
}

/** /admin/lembretes: dispara um gatilho de teste para o próprio admin, pelo n8n. */
export async function dispararTeste(gatilho: string): Promise<{ ok: boolean; mensagem: string }> {
  if (!/^[A-Z][0-9a-z]{1,3}$/.test(gatilho)) return { ok: false, mensagem: "Gatilho inválido." };
  const sessao = await exigirCadastroCompleto();
  const { data: admin } = await sessao.supabase.rpc("lembretes_sou_admin");
  if (admin !== true) return { ok: false, mensagem: "Sem permissão." };
  if (!process.env.N8N_WEBHOOK_URL || !process.env.LEMBRETES_SEGREDO) {
    return { ok: false, mensagem: "Faltam N8N_WEBHOOK_URL e LEMBRETES_SEGREDO na Vercel." };
  }
  const enviados = await enviarAoN8n([{ user_id: sessao.usuarioId, gatilho, dados: { teste: true } }]);
  revalidatePath("/admin/lembretes");
  return enviados
    ? { ok: true, mensagem: `${gatilho} enviado ao n8n. Confira o e-mail/push e a lista abaixo em alguns segundos.` }
    : { ok: false, mensagem: "O n8n não respondeu. Confira se o workflow está ativo." };
}

"use server";

import type { ResultadoBusca } from "@/dominio/busca";
import { exigirSessao } from "@/lib/sessao";

const FALHA = "Não consegui fazer isso agora. Tente de novo.";

export async function buscarUsuarios(q: string): Promise<{ ok: true; resultados: ResultadoBusca[] } | { ok: false; erro: string }> {
  const sessao = await exigirSessao();
  const { data, error } = await sessao.supabase.rpc("buscar_usuarios", { p_q: q });
  if (error) {
    return { ok: false, erro: error.message.includes("busca_muito_frequente") ? "Muitas buscas seguidas. Espere um minuto." : FALHA };
  }
  return { ok: true, resultados: (data as ResultadoBusca[] | null) ?? [] };
}

export async function buscarSugestoes(): Promise<ResultadoBusca[]> {
  const sessao = await exigirSessao();
  const { data } = await sessao.supabase.rpc("sugestoes_busca");
  return (data as ResultadoBusca[] | null) ?? [];
}

export async function seguirUsuario(alvoId: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("seguir_usuario", { p_alvo: alvoId });
  return error ? { ok: false, erro: FALHA } : { ok: true };
}

export async function deixarDeSeguirUsuario(alvoId: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("deixar_de_seguir", { p_alvo: alvoId });
  return error ? { ok: false, erro: FALHA } : { ok: true };
}

export async function bloquearUsuario(alvoId: string): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("bloquear_usuario", { p_alvo: alvoId });
  return error ? { ok: false, erro: FALHA } : { ok: true };
}

import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { proximoPasso, type EstadoOnboarding } from "@/dominio/onboarding";
import type { Perfil } from "@/dominio/perfil";
import { supabaseConfigurado } from "./supabase/env";
import { criarClienteServidor } from "./supabase/servidor";

export interface Sessao extends EstadoOnboarding {
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>;
  usuarioId: string;
  email: string | null;
  ofensiva: { atual: number; recorde: number; protetores: number; meta_compromisso: number | null };
}

/**
 * Lê o usuário logado e o estado do cadastro. Uma vez por requisição.
 * Devolve null quando não há login (ou o Supabase ainda não foi configurado).
 */
export const lerSessao = cache(async (): Promise<Sessao | null> => {
  if (!supabaseConfigurado) return null;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getUser();
  const usuario = data.user;
  if (!usuario) return null;

  const [perfil, aceites, triagem, ofensiva] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", usuario.id).maybeSingle(),
    supabase.from("consents").select("tipo").eq("user_id", usuario.id),
    supabase.from("health_screenings").select("id").eq("user_id", usuario.id).limit(1),
    supabase.from("streaks").select("atual,recorde,protetores,meta_compromisso").eq("user_id", usuario.id).maybeSingle(),
  ]);
  if (!perfil.data) return null;

  const streak = ofensiva.data ?? { atual: 0, recorde: 0, protetores: 0, meta_compromisso: null };
  return {
    supabase,
    usuarioId: usuario.id,
    email: usuario.email ?? null,
    perfil: perfil.data as Perfil,
    aceites: (aceites.data ?? []).map((a) => a.tipo as string),
    fezTriagem: (triagem.data ?? []).length > 0,
    compromisso: streak.meta_compromisso,
    ofensiva: streak,
  };
});

/** Para telas que pedem login: sem sessão, vai para /entrar. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await lerSessao();
  if (!sessao) redirect("/entrar");
  return sessao;
}

/** Para o app (trilha, liga, amigos, perfil): pede login e cadastro completo. */
export async function exigirCadastroCompleto(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (!sessao.perfil.onboarding_concluido_em) redirect(proximoPasso(sessao));
  return sessao;
}

/** Para as telas do primeiro acesso: quem já terminou vai direto para a trilha. */
export async function exigirCadastroEmAndamento(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.perfil.onboarding_concluido_em) redirect("/trilha");
  return sessao;
}

/** Para telas públicas: quem já está logado segue para onde parou. */
export async function seguirSeLogado(): Promise<void> {
  const sessao = await lerSessao();
  if (sessao) redirect(proximoPasso(sessao));
}

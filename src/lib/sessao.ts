import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { proximoPasso, type EstadoOnboarding } from "@/dominio/onboarding";
import type { Perfil } from "@/dominio/perfil";
import type { DadosTrilha } from "@/dominio/trilha";
import { destinoVisitante, type EstadoVisitante } from "@/dominio/visitante";
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

/**
 * Visitante (docs/VISITANTE.md): o desafio para jogar agora (o do convite, se
 * não estiver travado pela declaração de saúde, ou o primeiro liberado) e
 * quantos ele já concluiu.
 */
export async function lerEstadoVisitante(sessao: Sessao): Promise<EstadoVisitante & { ultimoConcluido: string | null }> {
  const [trilha, doConvite, feitos] = await Promise.all([
    sessao.supabase.rpc("ler_trilha"),
    sessao.supabase.rpc("meu_desafio_do_convite"),
    sessao.supabase.from("challenge_attempts").select("concluido_em")
      .eq("user_id", sessao.usuarioId).eq("status", "concluido").order("concluido_em", { ascending: false }).limit(1),
  ]);
  const desafios = (trilha.data as DadosTrilha | null)?.desafios ?? [];
  const convite = desafios.find((d) => d.id === doConvite.data && d.estado !== "travado");
  const primeiro = desafios.find((d) => d.estado === "disponivel");
  return {
    temUsername: Boolean(sessao.perfil.username),
    fezDeclaracao: Boolean(sessao.perfil.triagem_respondida_em),
    // Basta saber se já jogou: lê só o último concluído.
    desafiosConcluidos: feitos.data?.length ?? 0,
    desafio: convite?.id ?? primeiro?.id ?? null,
    ultimoConcluido: (feitos.data?.[0]?.concluido_em as string | undefined) ?? null,
  };
}

async function destinoDoVisitante(sessao: Sessao): Promise<string> {
  return destinoVisitante(await lerEstadoVisitante(sessao));
}

/** Para o app (trilha, liga, amigos, perfil): pede login e cadastro completo. */
export async function exigirCadastroCompleto(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.perfil.visitante) redirect(await destinoDoVisitante(sessao));
  if (!sessao.perfil.onboarding_concluido_em) redirect(proximoPasso(sessao));
  return sessao;
}

/** Para as telas do primeiro acesso: quem já terminou vai direto para a trilha. */
export async function exigirCadastroEmAndamento(): Promise<Sessao> {
  const sessao = await exigirSessao();
  if (sessao.perfil.visitante) redirect(await destinoDoVisitante(sessao));
  if (sessao.perfil.onboarding_concluido_em) redirect("/trilha");
  return sessao;
}

/**
 * Para o desafio e a hive: cadastro completo, ou visitante com username e
 * declaração de saúde. Sem login, vai começar como visitante.
 */
export async function exigirJogador(volta?: string): Promise<Sessao> {
  const comecar = volta && /^\/[a-z0-9/_-]{1,80}$/i.test(volta) ? `/comecar?volta=${encodeURIComponent(volta)}` : "/comecar";
  const sessao = await lerSessao();
  if (!sessao) redirect(comecar);
  if (sessao.perfil.visitante) {
    if (!sessao.perfil.username || !sessao.perfil.triagem_respondida_em) redirect(comecar);
    return sessao;
  }
  if (!sessao.perfil.onboarding_concluido_em) redirect(proximoPasso(sessao));
  return sessao;
}

/** Só para o visitante (tela de salvar o resultado). */
export async function exigirVisitante(): Promise<Sessao> {
  const sessao = await lerSessao();
  if (!sessao) redirect("/comecar");
  if (!sessao.perfil.visitante) redirect(proximoPasso(sessao));
  return sessao;
}

/** Para telas públicas: quem já está logado segue para onde parou. */
export async function seguirSeLogado(): Promise<void> {
  const sessao = await lerSessao();
  if (sessao) redirect(sessao.perfil.visitante ? await destinoDoVisitante(sessao) : proximoPasso(sessao));
}

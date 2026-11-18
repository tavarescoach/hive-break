"use server";

import { revalidatePath } from "next/cache";
import type { DadosHive } from "@/dominio/hive";
import { dispararLembretes } from "@/lib/lembretes";
import { exigirCadastroCompleto } from "@/lib/sessao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mensagem(erro: { message: string; hint?: string | null }): string {
  const m = erro.message;
  if (m.includes("desafio_travado")) return "Esse desafio tem intensidade acima da sua liberação da triagem. Escolha outra hive.";
  if (m.includes("desafio_bloqueado")) return "Esse desafio ainda está bloqueado na sua trilha. Escolha um que você já liberou.";
  if (m.includes("hive_encerrada")) return "Essa hive já acabou. Que tal começar outra?";
  if (m.includes("hive_inexistente")) return "Não achei essa hive. Confira o link.";
  if (/could not find the function|PGRST202|não existe|does not exist/i.test(m))
    return "O banco ainda não tem a hive. Falta rodar a migração 20261119001000_hive.sql no Supabase.";
  return "Não consegui falar com o servidor. Confira a internet e tente de novo.";
}

export async function criarHive(challengeId: string, competicao: boolean): Promise<{ ok: boolean; id?: string; erro?: string }> {
  if (!/^[a-z0-9_]+$/.test(challengeId)) return { ok: false, erro: "Desafio inválido." };
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("criar_hive", { p_challenge_id: challengeId, p_competicao: competicao });
  if (error) {
    // Já tem uma hive aberta: leva para ela.
    if (error.message.includes("hive_ativa") && error.hint && UUID.test(error.hint)) return { ok: true, id: error.hint };
    return { ok: false, erro: mensagem(error) };
  }
  revalidatePath("/hive");
  return { ok: true, id: data as string };
}

export async function entrarHive(id: string): Promise<{ ok: boolean; erro?: string }> {
  if (!UUID.test(id)) return { ok: false, erro: "Link inválido." };
  const sessao = await exigirCadastroCompleto();
  const { error } = await sessao.supabase.rpc("entrar_hive", { p_hive: id });
  if (error) return { ok: false, erro: mensagem(error) };
  revalidatePath("/hive");
  // S1: avisa o anfitrião.
  dispararLembretes(async () => (await sessao.supabase.rpc("lembretes_ao_entrar_hive", { p_hive: id })).data);
  return { ok: true };
}

/** High five dentro da hive: o Realtime mostra na hora; aqui fica o registro e o push agrupado (S6). */
export async function registrarHighFive(hiveId: string, para: string): Promise<void> {
  if (!UUID.test(hiveId) || !UUID.test(para)) return;
  const sessao = await exigirCadastroCompleto();
  const { data } = await sessao.supabase.rpc("registrar_high_five", { p_hive: hiveId, p_para: para });
  if (data !== true) return;
  const amigo = sessao.perfil.apelido ?? "Alguém";
  dispararLembretes(() => [{ user_id: para, gatilho: "S6", dados: { amigo } }]);
}

export async function comecarHiveAgora(id: string): Promise<void> {
  if (!UUID.test(id)) return;
  const sessao = await exigirCadastroCompleto();
  await sessao.supabase.rpc("comecar_hive_agora", { p_hive: id });
}

export async function definirCompeticao(id: string, valor: boolean): Promise<void> {
  if (!UUID.test(id)) return;
  const sessao = await exigirCadastroCompleto();
  await sessao.supabase.rpc("definir_competicao_hive", { p_hive: id, p_valor: valor });
}

/** Leva o resultado já gravado por finalizar_desafio para o card coletivo. */
export async function registrarResultadoHive(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("registrar_resultado_hive", { p_hive: id });
  return !error && data === true;
}

export async function lerHive(id: string): Promise<DadosHive | null> {
  if (!UUID.test(id)) return null;
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("ler_hive", { p_hive: id });
  if (error) return null;
  return (data as DadosHive | null) ?? null;
}

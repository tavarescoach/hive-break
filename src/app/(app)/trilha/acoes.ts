"use server";

import { revalidatePath } from "next/cache";
import { exigirCadastroCompleto } from "@/lib/sessao";

export interface ResultadoAcao {
  ok: boolean;
  xp?: number;
  erro?: string;
}

const ERROS: Record<string, string> = {
  bau_bloqueado: "Complete os desafios anteriores para abrir este baú.",
  bau_ja_aberto: "Você já abriu este baú.",
};

function mensagem(erro: { message: string }): string {
  const chave = Object.keys(ERROS).find((c) => erro.message.includes(c));
  return chave ? ERROS[chave] : "Não deu certo agora. Confira a internet e tente de novo.";
}

/** Abre um baú de XP. O servidor confere se ele já pode ser aberto. */
export async function abrirBau(unidade: string, posicao: number): Promise<ResultadoAcao> {
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("abrir_bau", { p_unit_id: unidade, p_posicao: posicao });
  if (error) return { ok: false, erro: mensagem(error) };
  revalidatePath("/trilha");
  return { ok: true, xp: (data as { xp: number }).xp };
}

/** "Pular para cá": libera a seção e passa a pessoa para ela. */
export async function pularParaSecao(secao: number): Promise<ResultadoAcao> {
  const sessao = await exigirCadastroCompleto();
  const { error } = await sessao.supabase.rpc("pular_para_secao", { p_level_id: secao });
  if (error) return { ok: false, erro: mensagem(error) };
  revalidatePath("/trilha");
  return { ok: true };
}

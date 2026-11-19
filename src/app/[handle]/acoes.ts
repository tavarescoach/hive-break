"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/app/onboarding/acoes";
import { validarCampo } from "@/dominio/perfil";
import { exigirSessao } from "@/lib/sessao";

/** O perfil público só existe depois que a pessoa escolhe um username (docs/VISITANTE.md). */
function revalidarPerfilPublico(username: string | null | undefined) {
  if (username) revalidatePath(`/@${username}`);
}

/** Vitrine de conquistas (docs/PERFIL.md, seção 3.2): até 3, só as já conquistadas. */
export async function definirVitrine(ids: string[]): Promise<{ ok: boolean; erro?: string }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("definir_vitrine", { p_ids: ids });
  if (error) return { ok: false, erro: "Não consegui salvar a vitrine agora." };
  revalidarPerfilPublico(sessao.perfil.username);
  return { ok: true };
}

/** High five no feed de amigos (seção 3.3): 1 por pessoa por dia. */
export async function darHighFive(paraId: string): Promise<{ ok: boolean }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("dar_high_five", { p_para: paraId });
  return { ok: !error };
}

/** Registra o peso de hoje (docs/PERFIL.md, seção 2.3). No máximo 1 por dia. */
export async function registrarPeso(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  const resultado = validarCampo("peso_kg", [String(formulario.get("peso_kg") ?? "")]);
  if (!resultado.ok) return { erro: resultado.erro };
  const { error } = await sessao.supabase.rpc("registrar_peso", { p_peso_kg: resultado.valor });
  if (error) return { erro: "Não consegui salvar. Confira a internet e tente de novo." };
  revalidarPerfilPublico(sessao.perfil.username);
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import type { EstadoFormulario } from "@/app/onboarding/acoes";
import { validarCampo } from "@/dominio/perfil";
import { exigirSessao } from "@/lib/sessao";

/** Registra o peso de hoje (docs/PERFIL.md, seção 2.3). No máximo 1 por dia. */
export async function registrarPeso(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  const resultado = validarCampo("peso_kg", [String(formulario.get("peso_kg") ?? "")]);
  if (!resultado.ok) return { erro: resultado.erro };
  const { error } = await sessao.supabase.rpc("registrar_peso", { p_peso_kg: resultado.valor });
  if (error) return { erro: "Não consegui salvar. Confira a internet e tente de novo." };
  revalidatePath(`/@${sessao.perfil.username}`);
  return {};
}

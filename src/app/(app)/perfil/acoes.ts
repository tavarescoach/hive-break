"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/app/onboarding/acoes";
import { ESTILOS_MUSICA, LIMITACOES, METAS_DIARIAS, validarCampo, validarInteiro, type CampoPerfil } from "@/dominio/perfil";
import { exigirSessao } from "@/lib/sessao";

const FALHA = "Não consegui salvar. Confira a internet e tente de novo.";

/** Autodeclaração de liberação médica (decisão do Luan). A data fica registrada. */
export async function declararLiberacao(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  if (formulario.get("confirmo") !== "on") return { erro: "Marque a confirmação para continuar." };
  const { error } = await sessao.supabase.rpc("declarar_liberacao_medica");
  if (error) return { erro: FALHA };
  revalidatePath("/perfil");
  return {};
}

export async function salvarConfiguracoes(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  const dados: Record<string, unknown> = {};

  const campos: [CampoPerfil, string][] = [
    ["apelido", "o apelido"],
    ["altura_cm", "a altura"],
    ["peso_kg", "o peso"],
    ["objetivo", "o objetivo"],
    ["dias_semana", "os dias por semana"],
    ["equipamentos", "o equipamento"],
  ];
  for (const [campo, rotulo] of campos) {
    const valores = formulario.getAll(campo).map(String);
    // Equipamento desmarcado por completo significa "nenhum".
    const resultado = validarCampo(campo, campo === "equipamentos" && valores.length === 0 ? ["nenhum"] : valores);
    if (!resultado.ok) return { erro: `Confira ${rotulo}: ${resultado.erro}` };
    dados[campo] = resultado.valor;
  }

  const meta = METAS_DIARIAS.find((m) => String(m.valor) === formulario.get("meta_desafios_dia"))?.valor;
  const estilo = ESTILOS_MUSICA.find((e) => e.valor === formulario.get("musica_estilo"))?.valor;
  const volumeMusica = validarInteiro(String(formulario.get("volume_musica")), 0, 100);
  const volumeVoz = validarInteiro(String(formulario.get("volume_voz")), 0, 100);
  if (!meta || !estilo || volumeMusica === null || volumeVoz === null) return { erro: "Confira a meta, a música e os volumes." };

  const horario = String(formulario.get("horario_lembrete") ?? "");
  if (horario !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) return { erro: "Confira o horário do lembrete." };
  const limitacoes = formulario.getAll("limitacoes").map(String);
  if (limitacoes.some((l) => !LIMITACOES.some((o) => o.valor === l))) return { erro: "Confira as limitações." };

  Object.assign(dados, {
    meta_desafios_dia: meta,
    musica_estilo: estilo,
    volume_musica: volumeMusica,
    volume_voz: volumeVoz,
    horario_lembrete: horario === "" ? null : horario,
    limitacoes,
  });

  const { error } = await sessao.supabase.from("profiles").update(dados).eq("id", sessao.usuarioId);
  if (error) return { erro: FALHA };
  revalidatePath("/perfil");
  redirect("/perfil");
}

export async function sair() {
  const sessao = await exigirSessao();
  await sessao.supabase.auth.signOut();
  redirect("/");
}

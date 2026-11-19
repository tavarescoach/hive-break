"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoFormulario } from "@/app/onboarding/acoes";
import { ESTILOS_MUSICA, ESTILOS_PROGRESSO, LIMITACOES, METAS_DIARIAS, validarCampo, validarInteiro, type CampoPerfil } from "@/dominio/perfil";
import { VERSAO_DECLARACAO } from "@/dominio/declaracao-saude";
import { erroDeFormato, mensagemDoMotivo, normalizarUsername } from "@/dominio/username";
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

/** Refazer a declaração de saúde (docs/VISITANTE.md, seção 4). */
export async function refazerDeclaracao(todasNao: boolean): Promise<{ erro?: string; destino?: string }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("registrar_declaracao_saude", {
    p_todas_nao: todasNao,
    p_ciente: true,
    p_versao: VERSAO_DECLARACAO,
  });
  if (error) return { erro: FALHA };
  revalidatePath("/trilha");
  return { destino: "/perfil/config?salvo=saude" };
}

/** Trocar o username: no máximo 1 vez a cada 30 dias (seção 5). */
export async function trocarUsername(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  const bruto = String(formulario.get("username") ?? "");
  const formato = erroDeFormato(bruto);
  if (formato) return { erro: formato };
  const { data, error } = await sessao.supabase.rpc("trocar_username", { p_username: normalizarUsername(bruto) });
  if (error) return { erro: FALHA };
  if (data) return { erro: mensagemDoMotivo(data as string) ?? FALHA };
  revalidatePath("/perfil");
  redirect("/perfil/config?salvo=username");
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
  const estiloProgresso = ESTILOS_PROGRESSO.find((e) => e.valor === formulario.get("estilo_progresso"))?.valor;
  const volumeMusica = validarInteiro(String(formulario.get("volume_musica")), 0, 100);
  const volumeVoz = validarInteiro(String(formulario.get("volume_voz")), 0, 100);
  if (!meta || !estilo || !estiloProgresso || volumeMusica === null || volumeVoz === null)
    return { erro: "Confira a meta, a música, o visual da tela de treino e os volumes." };

  // Contagem do pop-up "PREPARE-SE" (só existe depois da migração 0009).
  if (formulario.has("contagem_preparo_s")) {
    const contagem = validarInteiro(String(formulario.get("contagem_preparo_s")), 5, 10);
    if (contagem === null) return { erro: "Confira a contagem antes de cada exercício." };
    dados.contagem_preparo_s = contagem;
  }

  const horario = String(formulario.get("horario_lembrete") ?? "");
  if (horario !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) return { erro: "Confira o horário do lembrete." };
  const limitacoes = formulario.getAll("limitacoes").map(String);
  if (limitacoes.some((l) => !LIMITACOES.some((o) => o.valor === l))) return { erro: "Confira as limitações." };

  Object.assign(dados, {
    meta_desafios_dia: meta,
    musica_estilo: estilo,
    estilo_progresso: estiloProgresso,
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

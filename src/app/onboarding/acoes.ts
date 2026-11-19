"use server";

import { redirect } from "next/navigation";
import { proximoPasso, TIPOS_ACEITE } from "@/dominio/onboarding";
import { COMPROMISSOS, ESTILOS_MUSICA, ETAPAS_PERFIL, METAS_DIARIAS, validarCampo, validarFuso } from "@/dominio/perfil";
import { VERSAO_TERMOS } from "@/dominio/termos";
import { VERSAO_DECLARACAO } from "@/dominio/declaracao-saude";
import { dispararLembretes } from "@/lib/lembretes";
import { exigirSessao, lerSessao } from "@/lib/sessao";

export interface EstadoFormulario {
  erro?: string;
  /** Triagem: mostra a recomendação de procurar um médico antes de seguir. */
  recomendacao?: boolean;
}

const FALHA = "Não consegui salvar. Confira a internet e tente de novo.";

export async function aceitarTermos(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  if (TIPOS_ACEITE.some((tipo) => formulario.get(tipo) !== "on")) {
    return { erro: "Para continuar, marque os três aceites." };
  }
  const faltando = TIPOS_ACEITE.filter((tipo) => !sessao.aceites.includes(tipo));
  if (faltando.length) {
    const { error } = await sessao.supabase
      .from("consents")
      .insert(faltando.map((tipo) => ({ user_id: sessao.usuarioId, tipo, versao: VERSAO_TERMOS })));
    if (error) return { erro: FALHA };
  }
  redirect("/onboarding");
}

export async function salvarEtapaPerfil(idEtapa: string, _anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  const etapa = ETAPAS_PERFIL.find((e) => e.id === idEtapa);
  if (!etapa) return { erro: "Etapa desconhecida." };

  const resultado = validarCampo(etapa.campo, formulario.getAll("valor").map(String));
  if (!resultado.ok) return { erro: resultado.erro };

  const dados: Record<string, unknown> = { [etapa.campo]: resultado.valor };
  // O fuso do aparelho define a virada do dia da ofensiva e o horário dos avisos.
  const fuso = validarFuso(String(formulario.get("fuso") ?? ""));
  if (fuso) dados.fuso_horario = fuso;

  const { error } = await sessao.supabase.from("profiles").update(dados).eq("id", sessao.usuarioId);
  if (error) return { erro: error.message.includes("idade_minima") ? "O Hive Break é para maiores de 18 anos." : FALHA };

  const indice = ETAPAS_PERFIL.indexOf(etapa);
  const seguinte = ETAPAS_PERFIL[indice + 1];
  redirect(seguinte ? `/onboarding/perfil/${seguinte.id}` : "/onboarding");
}

/** Declaração de saúde (docs/VISITANTE.md, seção 4): substitui as 7 perguntas no cadastro. */
export async function salvarDeclaracao(todasNao: boolean): Promise<{ erro?: string; destino?: string }> {
  const sessao = await exigirSessao();
  const { error } = await sessao.supabase.rpc("registrar_declaracao_saude", {
    p_todas_nao: todasNao,
    p_ciente: true,
    p_versao: VERSAO_DECLARACAO,
  });
  if (error) return { erro: FALHA };
  return { destino: "/onboarding" };
}

export async function salvarMeta(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  const meta = METAS_DIARIAS.find((m) => String(m.valor) === formulario.get("meta"))?.valor;
  const compromisso = COMPROMISSOS.find((c) => String(c.valor) === formulario.get("compromisso"))?.valor;
  if (!meta || !compromisso) return { erro: "Escolha a meta diária e o compromisso de ofensiva." };

  const perfil = await sessao.supabase.from("profiles").update({ meta_desafios_dia: meta }).eq("id", sessao.usuarioId);
  if (perfil.error) return { erro: FALHA };
  const ofensiva = await sessao.supabase.rpc("definir_compromisso", { p_dias: compromisso });
  if (ofensiva.error) return { erro: FALHA };
  redirect("/onboarding");
}

export async function salvarMusica(_anterior: EstadoFormulario, formulario: FormData): Promise<EstadoFormulario> {
  const sessao = await exigirSessao();
  const estilo = ESTILOS_MUSICA.find((e) => e.valor === formulario.get("estilo"))?.valor;
  if (!estilo) return { erro: "Escolha um estilo, ou \"Sem música\"." };

  const perfil = await sessao.supabase.from("profiles").update({ musica_estilo: estilo }).eq("id", sessao.usuarioId);
  if (perfil.error) return { erro: FALHA };

  // O servidor confere se tudo foi preenchido antes de liberar a trilha.
  const { data, error } = await sessao.supabase.rpc("concluir_onboarding");
  if (error) return { erro: FALHA };
  if ((data as { ok: boolean }).ok) {
    // A1 (boas-vindas) e S1 para quem convidou.
    dispararLembretes(async () => (await sessao.supabase.rpc("lembretes_ao_concluir_cadastro")).data);
    redirect("/trilha");
  }
  redirect("/onboarding");
}

/** Depois da tela da câmera: segue para a música, ou volta à trilha se o cadastro já acabou. */
export async function destinoDepoisDaCamera(): Promise<string> {
  const sessao = await lerSessao();
  if (!sessao) return "/entrar";
  if (sessao.perfil.onboarding_concluido_em) return "/trilha";
  const passo = proximoPasso(sessao);
  return passo === "/camera" ? "/onboarding/musica" : passo;
}

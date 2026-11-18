"use server";

import { revalidatePath } from "next/cache";
import type { DadosResgate, FamiliaResgate } from "@/conteudo/resgate-ganchos";
import { escolherGanchosResgate } from "@/conteudo/resgate-ganchos";
import { dispararLembretes } from "@/lib/lembretes";
import { exigirCadastroCompleto } from "@/lib/sessao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CandidatoResgate {
  amigoId: string;
  apelido: string;
  avatarUrl: string | null;
  dias: number;
  appDisponivel: boolean;
}

interface LinhaCandidato {
  amigo_id: string;
  apelido: string | null;
  avatar_url: string | null;
  dias_parado: number;
  app_disponivel: boolean;
}

function mapCandidato(l: LinhaCandidato): CandidatoResgate {
  return { amigoId: l.amigo_id, apelido: l.apelido ?? "Alguém", avatarUrl: l.avatar_url, dias: l.dias_parado, appDisponivel: l.app_disponivel };
}

function mensagem(erro: { message: string }): string {
  const m = erro.message;
  if (m.includes("candidato_invalido")) return "Esse amigo não está mais disponível para resgate agora.";
  if (m.includes("canal_indisponivel")) return "Esse amigo desligou os avisos de Amigos/Hive. Só dá para chamar pelo WhatsApp.";
  if (m.includes("limite_diario_enviado")) return "Você já chamou 3 amigos hoje. Volte amanhã.";
  if (/could not find the function|PGRST202|não existe/i.test(m))
    return "O banco ainda não tem o resgate. Falta rodar as migrações 20261121000100_resgate_base.sql e 20261121000200_resgate_funcoes.sql no Supabase.";
  return "Não consegui falar com o servidor. Confira a internet e tente de novo.";
}

/** Pop-up da seção 3: no máximo 1 por dia, já aplica a ordem de prioridade. */
export async function buscarPopupResgate(): Promise<CandidatoResgate | null> {
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("resgate_popup_hoje");
  if (error || !data) return null;
  return mapCandidato(data as LinhaCandidato);
}

/** Faixa "amigos sumidos" da aba Amigos: a lista inteira, na mesma ordem. */
export async function listarAmigosSumidos(): Promise<CandidatoResgate[]> {
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("amigos_para_resgatar");
  if (error || !data) return [];
  return (data as LinhaCandidato[]).map(mapCandidato);
}

export async function dispensarResgate(amigoId: string): Promise<void> {
  if (!UUID.test(amigoId)) return;
  const sessao = await exigirCadastroCompleto();
  await sessao.supabase.rpc("resgate_dispensar", { p_amigo_id: amigoId });
}

export interface SugestoesResgate {
  sugestoes: ReturnType<typeof escolherGanchosResgate>;
  dados: DadosResgate;
}

/** As 3 sugestões da folha de escolha (seção 4), com o resultado de hoje de quem resgata. */
export async function buscarSugestoesResgate(): Promise<SugestoesResgate> {
  const sessao = await exigirCadastroCompleto();
  const { data } = await sessao.supabase.rpc("resgate_resultado_hoje");
  const dados: DadosResgate = { resultadoHoje: (data as DadosResgate["resultadoHoje"]) ?? null };
  return { sugestoes: escolherGanchosResgate(dados), dados };
}

/** "Abrir uma hive agora e chamar {amigo}": cria a hive no próprio próximo desafio e troca a sugestão de companhia pelo RC1. */
export async function abrirHiveParaResgate(): Promise<{ ok: boolean; hiveId?: string; erro?: string }> {
  const sessao = await exigirCadastroCompleto();
  const { data: proximo } = await sessao.supabase.rpc("ler_trilha");
  const challengeId = (proximo as { desafios?: { id: string; estado: string }[] } | null)?.desafios?.find((d) => d.estado === "disponivel")?.id;
  if (!challengeId) return { ok: false, erro: "Nenhum desafio disponível para abrir uma hive agora." };
  const { data, error } = await sessao.supabase.rpc("criar_hive", { p_challenge_id: challengeId, p_competicao: false });
  if (error) {
    if (error.message.includes("hive_ativa") && (error as { hint?: string }).hint) {
      return { ok: true, hiveId: (error as { hint?: string }).hint };
    }
    return { ok: false, erro: "Não consegui abrir a hive. Tente de novo." };
  }
  return { ok: true, hiveId: data as string };
}

export interface EnvioResgate {
  ok: boolean;
  erro?: string;
  /** Pelo WhatsApp (ou hive): o texto e o caminho para o cliente montar o compartilhamento. */
  compartilhar?: { texto: string; caminho: string };
}

/**
 * Manda o resgate (seção 5). Pelo app: dispara push + e-mail pelo mesmo
 * webhook do n8n dos outros gatilhos imediatos. Pelo WhatsApp/hive: devolve o
 * texto e o caminho para o componente abrir o menu de compartilhar nativo.
 */
export async function enviarResgate(
  amigoId: string,
  familia: FamiliaResgate,
  ganchoId: string,
  texto: string,
  canal: "app" | "whatsapp" | "hive",
  hiveId?: string,
): Promise<EnvioResgate> {
  if (!UUID.test(amigoId)) return { ok: false, erro: "Amigo inválido." };
  if (hiveId && !UUID.test(hiveId)) return { ok: false, erro: "Hive inválida." };
  const textoFinal = texto.trim().slice(0, 300);
  if (!textoFinal) return { ok: false, erro: "Escreva uma mensagem." };

  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("enviar_resgate", {
    p_para: amigoId,
    p_familia: familia,
    p_gancho_id: ganchoId,
    p_texto: textoFinal,
    p_canal: canal,
    p_hive_id: hiveId ?? null,
  });
  if (error) return { ok: false, erro: mensagem(error) };

  const resultado = data as { id: number; caminho: string };
  revalidatePath("/amigos");

  if (canal === "app") {
    const meuNome = sessao.perfil.apelido ?? "Um amigo";
    dispararLembretes(() => [{ user_id: amigoId, gatilho: "RESGATE", dados: { amigo: meuNome, gancho: textoFinal, caminho: resultado.caminho } }]);
    return { ok: true };
  }
  return { ok: true, compartilhar: { texto: textoFinal, caminho: `${resultado.caminho}?resgate=${resultado.id}` } };
}

export async function registrarResgateLinkAberto(resgateId: number): Promise<void> {
  if (!Number.isInteger(resgateId)) return;
  const sessao = await exigirCadastroCompleto();
  await sessao.supabase.rpc("registrar_resgate_link_aberto", { p_resgate_id: resgateId });
}

"use server";

import { cookies } from "next/headers";
import { VERSAO_DECLARACAO } from "@/dominio/declaracao-saude";
import { VERSAO_TERMOS } from "@/dominio/termos";
import { erroDeFormato, mensagemDoMotivo, normalizarUsername } from "@/dominio/username";
import { destinoVisitante } from "@/dominio/visitante";
import { COOKIE_CONVITE, COOKIE_GANCHO, normalizarCodigo, normalizarGanchoCookie } from "@/lib/convite";
import { lerEstadoVisitante, lerSessao } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export interface Disponibilidade {
  ok: boolean;
  mensagem: string | null;
  sugestoes: string[];
}

/** Checagem ao digitar (seção 5). Funciona antes de existir sessão. */
export async function verificarUsername(bruto: string): Promise<Disponibilidade> {
  const formato = erroDeFormato(bruto);
  if (formato) return { ok: false, mensagem: formato, sugestoes: [] };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("username_verificar", { p_username: normalizarUsername(bruto) });
  if (error || !data) return { ok: false, mensagem: "Não consegui conferir agora. Tente de novo.", sugestoes: [] };
  const r = data as { ok: boolean; motivo: string | null; sugestoes: string[] };
  return { ok: r.ok, mensagem: mensagemDoMotivo(r.motivo), sugestoes: r.sugestoes ?? [] };
}

export interface RespostaComecar {
  ok: boolean;
  destino?: string;
  erro?: string;
  /** O username foi recusado (outra pessoa pegou antes): volta para o passo 1. */
  username?: Disponibilidade;
}

/**
 * Passo 2 do fluxo (seção 1): roda depois do signInAnonymously no navegador.
 * Grava username, aceites e quem convidou (cookies da landing do convite) e
 * a declaração de saúde. Devolve para onde ir.
 */
export async function iniciarVisitante(usernameBruto: string, todasNao: boolean, volta: string | null): Promise<RespostaComecar> {
  const sessao = await lerSessao();
  if (!sessao?.perfil.visitante) return { ok: false, erro: "Não consegui abrir sua sessão de visitante. Recarregue a página." };

  const jarra = await cookies();
  const ref = normalizarCodigo(jarra.get(COOKIE_CONVITE)?.value ?? "");
  const gancho = normalizarGanchoCookie(jarra.get(COOKIE_GANCHO)?.value);

  const criado = await sessao.supabase.rpc("criar_visitante", {
    p_username: normalizarUsername(usernameBruto),
    p_maior_idade: true,
    p_versao_termos: VERSAO_TERMOS,
    p_ref: ref,
    p_familia: gancho?.familia ?? null,
    p_gancho_id: gancho?.ganchoId ?? null,
  });
  if (criado.error) return { ok: false, erro: "Não consegui salvar. Confira a internet e tente de novo." };
  const r = criado.data as { ok: boolean; motivo: string | null; sugestoes: string[] };
  if (!r.ok) return { ok: false, username: { ok: false, mensagem: mensagemDoMotivo(r.motivo), sugestoes: r.sugestoes ?? [] } };

  const declaracao = await sessao.supabase.rpc("registrar_declaracao_saude", {
    p_todas_nao: todasNao,
    p_ciente: true,
    p_versao: VERSAO_DECLARACAO,
  });
  if (declaracao.error) return { ok: false, erro: "Não consegui salvar a declaração. Tente de novo." };
  const { error: erroEvento } = await sessao.supabase.rpc("registrar_evento", { p_nome: "declaracao_aceita" });
  if (erroEvento) console.error("[eventos] registrar_evento(declaracao_aceita) falhou:", erroEvento.message, erroEvento);

  jarra.delete(COOKIE_CONVITE);
  jarra.delete(COOKIE_GANCHO);

  const estado = await lerEstadoVisitante(sessao);
  const destino = destinoVisitante({ ...estado, temUsername: true, fezDeclaracao: true });
  // Veio de um link de hive ou de desafio: volta para ele (se não for preciso confirmar o e-mail antes).
  const voltaValida = volta && /^\/(hive|desafio)\/[a-z0-9_-]{1,64}$/i.test(volta) ? volta : null;
  return { ok: true, destino: voltaValida && destino !== "/salvar" ? voltaValida : destino };
}

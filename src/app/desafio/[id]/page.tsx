import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { carregarDesafio } from "@/lib/carregar-desafio";
import { exigirEmailAntesDoDesafio } from "@/dominio/visitante";
import { exigirJogador } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { Desafio } from "./Desafio";

export const metadata: Metadata = { title: "Desafio · Hive Break" };

export default async function PaginaDesafio({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const { id } = await params;
  if (!/^[a-z0-9_]+$/.test(id)) notFound();
  const sessao = await exigirJogador(`/desafio/${id}`);
  const visitante = Boolean(sessao.perfil.visitante);
  // Seção 1.1 (VISITANTE.md): com a chave ligada, o código vem antes de jogar.
  if (visitante && exigirEmailAntesDoDesafio()) redirect("/salvar");

  const desafio = await carregarDesafio(sessao, id);
  if (!desafio) notFound();
  // O visitante pode fazer o desafio do convite mesmo bloqueado na trilha.
  const doConvite = visitante && desafio.estado === "bloqueado"
    && (await sessao.supabase.rpc("meu_desafio_do_convite")).data === id;
  // Bloqueado ou travado pela triagem: volta para a trilha.
  if ((desafio.estado === "bloqueado" && !doConvite) || desafio.estado === "travado") redirect(visitante ? "/salvar" : "/trilha");

  // Funil do convite (seção 4): não erra a tela se o evento não gravar.
  await sessao.supabase.rpc("registrar_desafio_iniciado").then(() => {}, () => {});

  return <Desafio {...desafio.props} />;
}


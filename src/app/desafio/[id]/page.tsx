import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { carregarDesafio } from "@/lib/carregar-desafio";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { Desafio } from "./Desafio";

export const metadata: Metadata = { title: "Desafio · Hive Break" };

export default async function PaginaDesafio({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const { id } = await params;
  if (!/^[a-z0-9_]+$/.test(id)) notFound();
  const sessao = await exigirCadastroCompleto();

  const desafio = await carregarDesafio(sessao, id);
  if (!desafio) notFound();
  // Bloqueado ou travado pela triagem: volta para a trilha.
  if (desafio.estado === "bloqueado" || desafio.estado === "travado") redirect("/trilha");

  return <Desafio {...desafio.props} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import type { DadosHive } from "@/dominio/hive";
import { carregarDesafio } from "@/lib/carregar-desafio";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { SalaHive } from "./SalaHive";

export const metadata: Metadata = { title: "Hive · Hive Break" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Uma hive: entrar, sala de espera, desafio junto e card coletivo. */
export default async function PaginaHive({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sessao = await exigirCadastroCompleto();

  const { data } = await sessao.supabase.rpc("ler_hive", { p_hive: id });
  const hive = data as DadosHive | null;
  if (!hive) notFound();
  const desafio = await carregarDesafio(sessao, hive.challenge_id);
  if (!desafio) notFound();

  return (
    <SalaHive
      inicial={hive}
      desafio={desafio.props}
      travado={desafio.estado === "travado"}
      eu={{ id: sessao.usuarioId, apelido: sessao.perfil.apelido ?? "Você", avatarUrl: sessao.perfil.avatar_url ?? null }}
    />
  );
}

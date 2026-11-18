import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lerSessao } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { CapaIdentidade, type PerfilResumo, type VarianteNoBanner } from "./CapaIdentidade";
import { PerfilColunas } from "./PerfilColunas";

/**
 * Rota /@username (docs/PERFIL.md): logado mostra o perfil próprio ou o de
 * outra pessoa; sem login mostra o perfil público. `[handle]` captura o
 * segmento inteiro da URL (com o "@"), porque uma pasta chamada "@algo" no
 * App Router é reservada para parallel routes, não para um segmento real.
 */
async function buscarPerfilPublico(username: string): Promise<PerfilResumo | null> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("perfis_publicos")
    .select("id, apelido, avatar_url, username, divisao_atual, nivel_atual, criado_em")
    .eq("username", username)
    .maybeSingle();
  return (data as PerfilResumo | null) ?? null;
}

async function carregarPagina(handleBruto: string) {
  if (!handleBruto.startsWith("@")) return null;
  const username = handleBruto.slice(1);
  const sessao = await lerSessao();

  if (sessao && sessao.perfil.username === username) {
    const perfil: PerfilResumo = sessao.perfil;
    return { perfil, variante: "proprio" as VarianteNoBanner, sessao };
  }

  const perfil = await buscarPerfilPublico(username);
  if (!perfil) return null;
  return { perfil, variante: (sessao ? "visitante_logado" : "publico") as VarianteNoBanner, sessao };
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const pagina = await carregarPagina(handle);
  if (!pagina) return {};
  return { title: `${pagina.perfil.apelido ?? handle} (@${pagina.perfil.username}) · Hive Break` };
}

export default async function PaginaPerfil({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const pagina = await carregarPagina(handle);
  if (!pagina) notFound();
  const { perfil, variante, sessao } = pagina;

  let hivesAoVivo = 0;
  if (sessao) {
    const { count } = await sessao.supabase
      .from("hives")
      .select("id", { count: "exact", head: true })
      .eq("visibilidade", "aberta")
      .gt("fim_em", new Date().toISOString());
    hivesAoVivo = count ?? 0;
  }

  return (
    <PerfilColunas perfilHref={sessao ? `/@${sessao.perfil.username}` : undefined} hivesAoVivo={hivesAoVivo}>
      <CapaIdentidade perfil={perfil} variante={variante} />
    </PerfilColunas>
  );
}

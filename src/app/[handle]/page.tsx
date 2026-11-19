import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lerSessao, type Sessao } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { CapaIdentidade, type PerfilResumo, type VarianteNoBanner } from "./CapaIdentidade";
import { MetaSemanaCard, type MetaSemanaDados } from "./MetaSemanaCard";
import { ObjetivoCard, type PesoCard } from "./ObjetivoCard";
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
    .select("id, apelido, avatar_url, username, divisao_atual, nivel_atual, criado_em, objetivo, meta_desafios_dia, dias_semana")
    .eq("username", username)
    .maybeSingle();
  return (data as PerfilResumo | null) ?? null;
}

/** peso_card() e meta_semana() valem para quem está logado e para quem não está (seção 2.3/2.4). */
async function carregarCardsDoCentro(sessao: Sessao | null, perfilId: string) {
  const supabase = sessao ? sessao.supabase : await criarClienteServidor();
  const [peso, meta] = await Promise.all([
    supabase.rpc("peso_card", { p_user: perfilId }),
    supabase.rpc("meta_semana", { p_user: perfilId }),
  ]);
  return { pesoCard: (peso.data as PesoCard | null) ?? null, metaSemana: (meta.data as MetaSemanaDados | null) ?? null };
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

  const { pesoCard, metaSemana } = await carregarCardsDoCentro(sessao, perfil.id);

  return (
    <PerfilColunas perfilHref={sessao ? `/@${sessao.perfil.username}` : undefined} hivesAoVivo={hivesAoVivo}>
      <div className="flex flex-col gap-4">
        <CapaIdentidade perfil={perfil} variante={variante} />
        <div className="flex flex-col gap-4 px-5">
          <ObjetivoCard objetivo={perfil.objetivo} pesoCard={pesoCard} souEu={variante === "proprio"} />
          {metaSemana && <MetaSemanaCard dados={metaSemana} />}
        </div>
      </div>
    </PerfilColunas>
  );
}

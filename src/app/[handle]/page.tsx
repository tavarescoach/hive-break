import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lerSessao, type Sessao } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { CalendarioHexagonos, type DiaCalendario } from "./CalendarioHexagonos";
import { CapaIdentidade, type PerfilResumo, type VarianteNoBanner } from "./CapaIdentidade";
import { EstatisticasGrid, type EstatisticasPerfil } from "./EstatisticasGrid";
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

/** estatisticas_perfil() vale para todo mundo; calendario_mes() só para quem está logado. */
async function carregarEstatisticas(sessao: Sessao | null, perfilId: string, ano: number, mes: number) {
  const supabase = sessao ? sessao.supabase : await criarClienteServidor();
  const estatisticas = await supabase.rpc("estatisticas_perfil", { p_user: perfilId });
  const dados = (estatisticas.data as EstatisticasPerfil | null) ?? null;
  if (!sessao || !dados || (dados.nivel !== "dono" && dados.nivel !== "completo")) {
    return { estatisticas: dados, dias: [] as DiaCalendario[] };
  }
  const calendario = await sessao.supabase.rpc("calendario_mes", { p_user: perfilId, p_ano: ano, p_mes: mes });
  return { estatisticas: dados, dias: (calendario.data as DiaCalendario[] | null) ?? [] };
}

function lerMes(bruto: string | undefined): { ano: number; mes: number } {
  const hoje = new Date();
  if (bruto && /^\d{4}-\d{2}$/.test(bruto)) {
    const [ano, mes] = bruto.split("-").map(Number);
    if (mes >= 1 && mes <= 12) return { ano, mes };
  }
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
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

export default async function PaginaPerfil({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { handle } = await params;
  const { mes: mesBruto } = await searchParams;
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

  const { ano, mes } = lerMes(mesBruto);
  const [{ pesoCard, metaSemana }, { estatisticas, dias }] = await Promise.all([
    carregarCardsDoCentro(sessao, perfil.id),
    carregarEstatisticas(sessao, perfil.id, ano, mes),
  ]);
  const hojeIso = new Date().toISOString().slice(0, 10);
  const treinouHoje = metaSemana?.dias.some((d) => d.dia === hojeIso && d.hives > 0) ?? false;

  return (
    <PerfilColunas perfilHref={sessao ? `/@${sessao.perfil.username}` : undefined} hivesAoVivo={hivesAoVivo}>
      <div className="flex flex-col gap-4">
        <CapaIdentidade perfil={perfil} variante={variante} />
        <div className="flex flex-col gap-4 px-5">
          <ObjetivoCard objetivo={perfil.objetivo} pesoCard={pesoCard} souEu={variante === "proprio"} />
          {metaSemana && <MetaSemanaCard dados={metaSemana} />}
          {estatisticas && <EstatisticasGrid dados={estatisticas} treinouHoje={treinouHoje} />}
          {dias.length > 0 && <CalendarioHexagonos dias={dias} ano={ano} mes={mes} baseHref={`/@${perfil.username}`} hojeIso={hojeIso} />}
        </div>
      </div>
    </PerfilColunas>
  );
}

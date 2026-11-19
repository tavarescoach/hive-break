import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ProgressoConquista } from "@/dominio/conquistas";
import { perfilHref } from "@/dominio/perfil";
import { lerSessao, type Sessao } from "@/lib/sessao";
import { origemAbsoluta } from "@/lib/origem";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { CalendarioHexagonos, type DiaCalendario } from "./CalendarioHexagonos";
import { CapaIdentidade, type PerfilResumo, type VarianteNoBanner } from "./CapaIdentidade";
import { EstatisticasGrid, type EstatisticasPerfil } from "./EstatisticasGrid";
import { FeedAmigos, type EventoFeed } from "./FeedAmigos";
import { ListaRede, type PessoaRede } from "./ListaRede";
import { MetaSemanaCard, type MetaSemanaDados } from "./MetaSemanaCard";
import { ObjetivoCard, type PesoCard } from "./ObjetivoCard";
import { PerfilColunas } from "./PerfilColunas";
import { VitrineConquistas } from "./VitrineConquistas";
import { VocesDois, type HivesEmComum } from "./VocesDois";

/**
 * Rota /@username (docs/PERFIL.md): logado mostra o perfil próprio ou o de
 * outra pessoa; sem login mostra o perfil público. `[handle]` captura o
 * segmento inteiro da URL (com o "@"), porque uma pasta chamada "@algo" no
 * App Router é reservada para parallel routes, não para um segmento real.
 */
async function buscarPerfilPublico(username: string): Promise<PerfilResumo | null> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("perfis_publicos")
    .select("id, apelido, avatar_url, username, divisao_atual, nivel_atual, criado_em, objetivo, meta_desafios_dia, dias_semana, vitrine_conquistas")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    // Diagnóstico temporário (seção "deploy", issue do @luan 404): sem isso, qualquer
    // erro de consulta virava um 404 silencioso, indistinguível de "não existe".
    console.error(`[/@${username}] buscarPerfilPublico falhou:`, error);
  }
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

/** Coluna da direita (seção 3): vitrine sempre; feed e seguindo/seguidores só no próprio perfil. */
async function carregarColunaDaDireita(sessao: Sessao | null, variante: VarianteNoBanner, perfilId: string) {
  const supabase = sessao ? sessao.supabase : await criarClienteServidor();
  const conquistas = await supabase.rpc("progresso_conquistas", { p_user: perfilId });

  let conquistasViewer: ProgressoConquista[] | null = null;
  if (variante === "visitante_logado" && sessao) {
    const r = await sessao.supabase.rpc("progresso_conquistas", { p_user: sessao.usuarioId });
    conquistasViewer = (r.data as ProgressoConquista[] | null) ?? null;
  }

  let feed: EventoFeed[] = [];
  let seguindo: PessoaRede[] = [];
  let seguidores: PessoaRede[] = [];
  if (variante === "proprio" && sessao) {
    const [f, s1, s2] = await Promise.all([
      sessao.supabase.rpc("feed_amigos"),
      sessao.supabase.rpc("minha_rede", { p_tipo: "seguindo" }),
      sessao.supabase.rpc("minha_rede", { p_tipo: "seguidores" }),
    ]);
    feed = (f.data as EventoFeed[] | null) ?? [];
    seguindo = (s1.data as PessoaRede[] | null) ?? [];
    seguidores = (s2.data as PessoaRede[] | null) ?? [];
  }

  return { conquistas: (conquistas.data as ProgressoConquista[] | null) ?? [], conquistasViewer, feed, seguindo, seguidores };
}

/** "Vocês dois" (seção 2.7): a semana de cada um e as hives feitas juntos. */
async function carregarVocesDois(sessao: Sessao, alvoId: string) {
  const [minhaSemana, semanaDele, meus, dele] = await Promise.all([
    sessao.supabase.rpc("meta_semana", { p_user: sessao.usuarioId }),
    sessao.supabase.rpc("meta_semana", { p_user: alvoId }),
    sessao.supabase.from("hive_participantes").select("hive_id, entrou_em").eq("user_id", sessao.usuarioId).not("concluido_em", "is", null),
    sessao.supabase.from("hive_participantes").select("hive_id, entrou_em").eq("user_id", alvoId).not("concluido_em", "is", null),
  ]);
  const meusHives = (meus.data ?? []) as { hive_id: string; entrou_em: string }[];
  const hivesDele = (dele.data ?? []) as { hive_id: string; entrou_em: string }[];
  const idsComuns = new Set(meusHives.map((h) => h.hive_id));
  const datasComuns = hivesDele.filter((h) => idsComuns.has(h.hive_id)).map((h) => h.entrou_em);

  return {
    meusDias: (minhaSemana.data as MetaSemanaDados | null)?.dias ?? [],
    diasDele: (semanaDele.data as MetaSemanaDados | null)?.dias ?? [],
    comum: { total: datasComuns.length, ultima: datasComuns.length ? datasComuns.sort().at(-1)! : null } satisfies HivesEmComum,
  };
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
  // Diagnóstico temporário (seção "deploy", issue do @luan 404): tira depois de confirmar a causa.
  console.log(`[/@${username}] logado=${!!sessao} meu_username=${sessao?.perfil.username ?? "—"}`);

  if (sessao && sessao.perfil.username === username) {
    // `username` vem da URL (sempre uma string real): mais seguro que o
    // `sessao.perfil.username` do tipo Perfil, que o Visitante tornou opcional.
    const perfil: PerfilResumo = { ...sessao.perfil, username };
    return { perfil, variante: "proprio" as VarianteNoBanner, sessao };
  }

  const perfil = await buscarPerfilPublico(username);
  if (!perfil) {
    console.log(`[/@${username}] perfis_publicos não achou ninguém com esse username`);
    return null;
  }

  if (sessao) {
    // Bloqueio nos dois sentidos (docs/PERFIL.md, seção 4.1): "não consegue te ver".
    const { data: bloqueado, error } = await sessao.supabase.rpc("bloqueado_entre", { p_a: sessao.usuarioId, p_b: perfil.id });
    if (error) console.error(`[/@${username}] bloqueado_entre falhou:`, error);
    if (bloqueado) return null;
  }

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
  const souVisitanteLogado = variante === "visitante_logado" && !!sessao;
  const [{ pesoCard, metaSemana }, { estatisticas, dias }, relacao, direitaDados, vocesDois, origem] = await Promise.all([
    carregarCardsDoCentro(sessao, perfil.id),
    carregarEstatisticas(sessao, perfil.id, ano, mes),
    souVisitanteLogado
      ? sessao!.supabase.rpc("relacao_com", { p_user: sessao!.usuarioId, p_alvo: perfil.id }).then((r) => r.data as { seguindo: boolean; segue_voce: boolean } | null)
      : Promise.resolve(null),
    carregarColunaDaDireita(sessao, variante, perfil.id),
    souVisitanteLogado ? carregarVocesDois(sessao!, perfil.id) : Promise.resolve(null),
    origemAbsoluta(),
  ]);
  const hojeIso = new Date().toISOString().slice(0, 10);
  const treinouHoje = metaSemana?.dias.some((d) => d.dia === hojeIso && d.hives > 0) ?? false;

  const direita = (
    <div className="flex flex-col gap-4">
      <VitrineConquistas
        conquistas={direitaDados.conquistas}
        vitrineIds={perfil.vitrine_conquistas}
        souEu={variante === "proprio"}
        conquistasViewer={direitaDados.conquistasViewer}
      />
      {variante === "proprio" && (
        <>
          <FeedAmigos eventos={direitaDados.feed} />
          <ListaRede seguindo={direitaDados.seguindo} seguidores={direitaDados.seguidores} />
        </>
      )}
    </div>
  );

  return (
    <PerfilColunas perfilHref={sessao ? perfilHref(sessao.perfil.username) : undefined} hivesAoVivo={hivesAoVivo} direita={direita}>
      <div className="flex flex-col gap-4">
        <CapaIdentidade perfil={perfil} variante={variante} relacao={relacao} link={`${origem}/@${perfil.username}`} />
        <div className="flex flex-col gap-4 px-5">
          <ObjetivoCard objetivo={perfil.objetivo} pesoCard={pesoCard} souEu={variante === "proprio"} />
          {metaSemana && <MetaSemanaCard dados={metaSemana} />}
          {estatisticas && <EstatisticasGrid dados={estatisticas} treinouHoje={treinouHoje} />}
          {dias.length > 0 && <CalendarioHexagonos dias={dias} ano={ano} mes={mes} baseHref={`/@${perfil.username}`} hojeIso={hojeIso} />}
          {vocesDois && <VocesDois nome={perfil.apelido ?? perfil.username} meusDias={vocesDois.meusDias} diasDele={vocesDois.diasDele} comum={vocesDois.comum} />}
        </div>
      </div>
    </PerfilColunas>
  );
}

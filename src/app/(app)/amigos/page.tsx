import type { Metadata } from "next";
import { sobrelinha } from "@/componentes/estilos";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { buscarSugestoes } from "./buscar/acoes";
import { CartaoConvite } from "./CartaoConvite";
import { FaixaAmigosSumidos } from "./FaixaAmigosSumidos";
import { FeedAmigos, type EventoFeed } from "./FeedAmigos";
import { ListaRede, type PessoaRede } from "./ListaRede";
import { ModalBuscarAmigos } from "./ModalBuscarAmigos";
import { ModalConvites, type ConvidadoResumo } from "./ModalConvites";

export const metadata: Metadata = { title: "Amigos · Hive Break" };

interface Convite {
  invitee_id: string;
  cadastrado_em: string;
  ativado_em: string | null;
}

export default async function Amigos() {
  const sessao = await exigirCadastroCompleto();
  const [sugestoes, feed, seguindo, seguidores, { data: convites }] = await Promise.all([
    buscarSugestoes(),
    sessao.supabase.rpc("feed_amigos").then((r) => (r.data as EventoFeed[] | null) ?? []),
    sessao.supabase.rpc("minha_rede", { p_tipo: "seguindo" }).then((r) => (r.data as PessoaRede[] | null) ?? []),
    sessao.supabase.rpc("minha_rede", { p_tipo: "seguidores" }).then((r) => (r.data as PessoaRede[] | null) ?? []),
    sessao.supabase
      .from("invites")
      .select("invitee_id,cadastrado_em,ativado_em")
      .eq("inviter_id", sessao.usuarioId)
      .order("cadastrado_em", { ascending: false }),
  ]);
  const lista = (convites ?? []) as Convite[];
  // Dos convidados só dá para ver o que é público: apelido, foto e username.
  const { data: publicos } = lista.length
    ? await sessao.supabase.from("perfis_publicos").select("id,apelido,avatar_url,username").in("id", lista.map((c) => c.invitee_id))
    : { data: [] };
  const porId = new Map(
    (publicos ?? []).map((p) => [p.id as string, p as { apelido: string; avatar_url: string | null; username: string | null }]),
  );
  const ativados = lista.filter((c) => c.ativado_em).length;
  // Quem já fez o 1º desafio virou seguidor automático (ativar_convite): o perfil dessa pessoa já é inspecionável.
  const convidados: ConvidadoResumo[] = lista.map((convite) => {
    const pessoa = porId.get(convite.invitee_id);
    return {
      id: convite.invitee_id,
      nome: pessoa?.apelido ?? "Novo convidado",
      username: pessoa?.username ?? null,
      avatarUrl: pessoa?.avatar_url ?? null,
      situacao: convite.ativado_em ? "fez_desafio" : pessoa ? "cadastro_pronto" : "cadastrando",
    };
  });

  return (
    <main className="flex flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Amigos</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Treine com um amigo</h1>
        <p className="mt-2 text-base leading-relaxed text-apagado">
          Quando seu convidado concluir o 1º desafio, vocês dois ganham um protetor de ofensiva.
        </p>
      </header>

      <FeedAmigos eventos={feed} />

      <ListaRede seguindo={seguindo} seguidores={seguidores} />

      <FaixaAmigosSumidos />

      <ModalBuscarAmigos sugestoes={sugestoes} />

      <CartaoConvite codigo={sessao.perfil.codigo_convite} />

      <ModalConvites convidados={convidados} ativados={ativados} />
    </main>
  );
}

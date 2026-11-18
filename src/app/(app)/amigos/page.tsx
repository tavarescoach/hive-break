import type { Metadata } from "next";
import { Avatar } from "@/componentes/Avatar";
import { cartao, sobrelinha } from "@/componentes/estilos";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { CartaoConvite } from "./CartaoConvite";
import { FaixaAmigosSumidos } from "./FaixaAmigosSumidos";

export const metadata: Metadata = { title: "Amigos · Hive Break" };

interface Convite {
  invitee_id: string;
  cadastrado_em: string;
  ativado_em: string | null;
}

export default async function Amigos() {
  const sessao = await exigirCadastroCompleto();
  const { data: convites } = await sessao.supabase
    .from("invites")
    .select("invitee_id,cadastrado_em,ativado_em")
    .eq("inviter_id", sessao.usuarioId)
    .order("cadastrado_em", { ascending: false });
  const lista = (convites ?? []) as Convite[];
  // Dos convidados só dá para ver o que é público: apelido e foto.
  const { data: publicos } = lista.length
    ? await sessao.supabase.from("perfis_publicos").select("id,apelido,avatar_url").in("id", lista.map((c) => c.invitee_id))
    : { data: [] };
  const porId = new Map((publicos ?? []).map((p) => [p.id as string, p as { apelido: string; avatar_url: string | null }]));
  const ativados = lista.filter((c) => c.ativado_em).length;

  return (
    <main className="flex flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Amigos</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Treine com um amigo</h1>
        <p className="mt-2 text-base leading-relaxed text-apagado">
          Quando seu convidado concluir o 1º desafio, vocês dois ganham um protetor de ofensiva.
        </p>
      </header>

      <FaixaAmigosSumidos />

      <CartaoConvite codigo={sessao.perfil.codigo_convite} />

      <section>
        <h2 className="text-base font-bold">Seus convites</h2>
        {lista.length === 0 ? (
          <p className="mt-2 text-[15px] leading-relaxed text-apagado">
            Ninguém entrou pelo seu link ainda. Mande para quem você quer ver treinando.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[15px] text-apagado">
              {lista.length} {lista.length === 1 ? "pessoa entrou" : "pessoas entraram"} pelo seu link · {ativados}{" "}
              {ativados === 1 ? "já fez" : "já fizeram"} o 1º desafio
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {lista.map((convite) => {
                const pessoa = porId.get(convite.invitee_id);
                const nome = pessoa?.apelido ?? "Novo convidado";
                return (
                  <li key={convite.invitee_id} className={`${cartao} flex items-center gap-3 py-3`}>
                    <Avatar url={pessoa?.avatar_url ?? null} nome={nome} tamanho={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{nome}</p>
                      <p className="text-sm text-apagado">
                        {convite.ativado_em ? "Fez o 1º desafio" : pessoa ? "Cadastro pronto, falta o 1º desafio" : "Ainda terminando o cadastro"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Assinatura } from "@/componentes/Assinatura";
import { Avatar } from "@/componentes/Avatar";
import { BotaoEnviar } from "@/componentes/BotaoEnviar";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { OG_POR_FAMILIA } from "@/conteudo/ganchos";
import { familiaDaQuery, ganchoIdDaQuery, normalizarCodigo } from "@/lib/convite";
import { seguirSeLogado } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { aceitarConvite } from "./acoes";

interface Convite {
  apelido: string;
  avatar_url: string | null;
  ofensiva: number;
}

type ParamsConvite = { codigo: string };
type QueryGancho = { g?: string; h?: string };

async function lerConvite(codigo: string | null): Promise<Convite | null> {
  if (!codigo || !supabaseConfigurado) return null;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("convite_publico", { p_codigo: codigo }).maybeSingle();
  return (data as Convite | null) ?? null;
}

/** Prévia do link no WhatsApp, por família (seção 3.2). A imagem é a rota /imagem, nunca o logo genérico. */
export async function generateMetadata(
  { params, searchParams }: { params: Promise<ParamsConvite>; searchParams: Promise<QueryGancho> },
): Promise<Metadata> {
  const codigo = normalizarCodigo((await params).codigo);
  const familia = familiaDaQuery((await searchParams).g);
  const convite = await lerConvite(codigo);
  if (!convite || !familia) {
    return { title: "Você foi convidado · Hive Break", robots: { index: false } };
  }
  const nome = convite.apelido;
  const og = OG_POR_FAMILIA[familia];
  const titulo = og.titulo.replace("{nome}", nome);
  const descricao =
    familia === "D" && convite.ofensiva > 0
      ? `${nome} está numa sequência de ${convite.ofensiva} ${convite.ofensiva === 1 ? "dia" : "dias"}. Leva 3 minutos, direto no navegador.`
      : og.descricao.replace("{nome}", nome).replace(/\{exercicio\}: \{reps\}\. /, "");
  const imagem = `/c/${codigo}/imagem?g=${familia}`;
  return {
    title: titulo,
    robots: { index: false },
    openGraph: { title: titulo, description: descricao, images: [imagem] },
    twitter: { card: "summary_large_image", title: titulo, description: descricao, images: [imagem] },
  };
}

export default async function LandingConvite(
  { params, searchParams }: { params: Promise<ParamsConvite>; searchParams: Promise<QueryGancho> },
) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  await seguirSeLogado();
  const codigo = normalizarCodigo((await params).codigo);
  const query = await searchParams;
  const familia = familiaDaQuery(query.g);
  const ganchoId = ganchoIdDaQuery(query.h);
  const convite = await lerConvite(codigo);

  if (convite && codigo && familia && ganchoId) {
    const supabase = await criarClienteServidor();
    await supabase.rpc("registrar_link_aberto", { p_codigo: codigo, p_familia: familia, p_gancho_id: ganchoId }).then(
      () => {},
      () => {},
    );
  }

  if (!convite) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-5 px-5">
        <p className={sobrelinha}>Hive Break</p>
        <h1 className="text-3xl font-black leading-tight">Este convite não vale mais</h1>
        <p className="text-base leading-relaxed text-apagado">
          O link pode ter sido digitado errado. Você pode começar mesmo assim.
        </p>
        <Link href="/" className={botaoSecundario}>
          Conhecer o Hive Break
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-5 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Hive Break</p>
        <div className="mt-5 flex items-center gap-4">
          <Avatar url={convite.avatar_url} nome={convite.apelido} tamanho={72} />
          <div>
            <h1 className="text-3xl font-black leading-tight">{convite.apelido} te convidou</h1>
            <p className="mt-1 text-base text-apagado">
              {convite.ofensiva > 0
                ? `Está numa ofensiva de ${convite.ofensiva} ${convite.ofensiva === 1 ? "dia" : "dias"} seguidos.`
                : "Está começando agora. Bora junto?"}
            </p>
          </div>
        </div>
      </header>

      <section className={cartao}>
        <p className="text-lg font-bold leading-snug">Um desafio de 5 minutos por dia, com um treinador na câmera.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-apagado">
          Quando você concluir o 1º desafio, você e {convite.apelido} ganham um protetor de ofensiva e viram amigos no
          app.
        </p>
      </section>

      <form action={aceitarConvite} className="mt-auto flex flex-col gap-4">
        <input type="hidden" name="codigo" value={codigo ?? ""} />
        <input type="hidden" name="g" value={familia ?? ""} />
        <input type="hidden" name="h" value={ganchoId ?? ""} />
        <BotaoEnviar>Aceitar convite</BotaoEnviar>
        <p className="text-center text-xs leading-relaxed text-apagado">
          A câmera é processada no seu aparelho. Nenhuma imagem ou vídeo é gravado ou enviado.
        </p>
        <Assinatura />
      </form>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Assinatura } from "@/componentes/Assinatura";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { sobrelinha } from "@/componentes/estilos";
import { FluxoCodigo } from "@/componentes/FluxoCodigo";
import { seguirSeLogado } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { BotaoGoogle } from "./BotaoGoogle";

export const metadata: Metadata = { title: "Entrar · Hive Break" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  await seguirSeLogado();
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Hive Break</p>
        <h1 className="mt-3 text-4xl font-black leading-[1.05]">Entrar</h1>
        <p className="mt-4 text-base leading-relaxed text-apagado">
          Digite seu e-mail e mandamos um código de 6 números. Sem senha.
        </p>
      </header>
      <div className="mt-8 flex flex-1 flex-col gap-4">
        {erro && (
          <p role="alert" className="rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px] text-texto">
            Não deu para concluir o login. Tente de novo.
          </p>
        )}
        <FluxoCodigo fluxoInicial="login" botao="Mandar código" />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <p className="text-center text-sm text-apagado">ou</p>
        <BotaoGoogle pequeno />
        <Link href="/comecar" className="py-2 text-center text-[15px] font-semibold text-apagado underline underline-offset-4">
          Ainda não tem conta? Começar
        </Link>
        <Assinatura />
      </div>
    </main>
  );
}

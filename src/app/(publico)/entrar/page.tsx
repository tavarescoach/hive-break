import type { Metadata } from "next";
import Link from "next/link";
import { Assinatura } from "@/componentes/Assinatura";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { sobrelinha } from "@/componentes/estilos";
import { seguirSeLogado } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { BotaoGoogle } from "./BotaoGoogle";

export const metadata: Metadata = { title: "Entrar · Hive Break" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  await seguirSeLogado();
  const { erro } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Hive Break</p>
        <h1 className="mt-3 text-4xl font-black leading-[1.05]">Entre para começar sua ofensiva.</h1>
        <p className="mt-4 text-base leading-relaxed text-apagado">
          Um toque com a sua conta Google. Usamos só seu nome, e-mail e foto.
        </p>
      </header>
      <div className="flex flex-col gap-4">
        {erro && (
          <p role="alert" className="rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px] text-texto">
            Não deu para concluir o login. Tente de novo.
          </p>
        )}
        <BotaoGoogle />
        <Link href="/" className="py-2 text-center text-[15px] font-semibold text-apagado underline underline-offset-4">
          Voltar
        </Link>
        <Assinatura />
      </div>
    </main>
  );
}

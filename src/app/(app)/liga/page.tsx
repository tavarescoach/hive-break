import type { Metadata } from "next";
import { cartao, sobrelinha } from "@/componentes/estilos";
import { exigirCadastroCompleto } from "@/lib/sessao";

export const metadata: Metadata = { title: "Liga · Hive Break" };

const DIVISOES: Record<string, string> = { bronze: "Bronze", prata: "Prata", ouro: "Ouro", safira: "Safira", diamante: "Diamante" };

export default async function Liga() {
  const { perfil } = await exigirCadastroCompleto();
  return (
    <main className="flex flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Liga</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Divisão {DIVISOES[perfil.divisao_atual]}</h1>
      </header>
      <section className={cartao}>
        <p className="text-lg font-bold leading-tight">A liga semanal começa em breve</p>
        <p className="mt-1 text-[15px] leading-relaxed text-apagado">
          Toda segunda você entra num grupo de 30 pessoas. Os pontos vêm da nota dos seus desafios; os 7 primeiros sobem
          de divisão.
        </p>
      </section>
    </main>
  );
}

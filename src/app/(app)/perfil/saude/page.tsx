import type { Metadata } from "next";
import { sobrelinha } from "@/componentes/estilos";
import { TelaDeclaracao } from "@/componentes/TelaDeclaracao";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { refazerDeclaracao } from "../acoes";

export const metadata: Metadata = { title: "Declaração de saúde · Hive Break" };

/** Refazer a declaração de saúde (docs/VISITANTE.md, seção 4). */
export default async function Saude() {
  const { perfil } = await exigirCadastroCompleto();
  return (
    <main className="flex min-h-[80dvh] flex-col gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Perfil</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Declaração de saúde</h1>
        <p className="mt-2 text-base leading-relaxed text-apagado">
          {perfil.triagem_restricao
            ? "Hoje você está com respiração e alongamento leve. Se algo mudou, responda de novo."
            : "Se algo mudou na sua saúde, responda de novo."}
        </p>
      </header>
      <TelaDeclaracao acao={refazerDeclaracao} botao="Responder de novo" />
    </main>
  );
}

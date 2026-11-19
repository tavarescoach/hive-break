import type { Metadata } from "next";
import type { DadosTrilha } from "@/dominio/trilha";
import type { HiveAcessoriaBanco } from "@/dominio/trilhaAcessoria";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { TrilhaCliente } from "./TrilhaCliente";

export const metadata: Metadata = { title: "Trilha · Hive Break" };

export default async function Trilha() {
  const sessao = await exigirCadastroCompleto();
  const [{ data, error }, acessorias] = await Promise.all([
    sessao.supabase.rpc("ler_trilha"),
    sessao.supabase.rpc("ler_trilhas_acessorias"),
  ]);
  if (error || !data) {
    return (
      <main className="flex min-h-[70dvh] flex-col justify-center gap-3 px-5">
        <h1 className="text-2xl font-black">Não consegui carregar a trilha</h1>
        <p className="text-base leading-relaxed text-apagado">Confira a internet e abra de novo.</p>
      </main>
    );
  }
  // Trilhas acessórias: se a chamada falhar, a trilha principal segue normal, só sem os personagens ao lado.
  return <TrilhaCliente dados={data as DadosTrilha} acessorias={(acessorias.data as HiveAcessoriaBanco[] | null) ?? []} />;
}

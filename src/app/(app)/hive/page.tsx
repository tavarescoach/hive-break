import type { Metadata } from "next";
import type { DadosHive } from "@/dominio/hive";
import type { DadosTrilha } from "@/dominio/trilha";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { ListaHives, type OpcaoDesafio } from "./ListaHives";

export const metadata: Metadata = { title: "Hive · Hive Break" };

/** Aba Hive: hives ao vivo para dar join e o botão para começar uma. */
export default async function Hive() {
  const sessao = await exigirCadastroCompleto();
  const [hives, trilha] = await Promise.all([sessao.supabase.rpc("listar_hives"), sessao.supabase.rpc("ler_trilha")]);

  if (hives.error) {
    return (
      <main className="flex min-h-[70dvh] flex-col justify-center gap-3 px-5">
        <h1 className="text-2xl font-black">A hive ainda não está no ar</h1>
        <p className="text-base leading-relaxed text-apagado">
          {/does not exist|could not find|PGRST202/i.test(hives.error.message)
            ? "Falta rodar a migração 20261119001000_hive.sql no Supabase."
            : "Confira a internet e abra de novo."}
        </p>
      </main>
    );
  }

  // Para começar uma hive: desafios liberados (o próximo da trilha primeiro).
  const dados = trilha.data as DadosTrilha | null;
  const unidades = new Map((dados?.unidades ?? []).map((u) => [u.id, u]));
  const niveis = new Map((dados?.niveis ?? []).map((n) => [n.id, n]));
  const opcoes: OpcaoDesafio[] = (dados?.desafios ?? [])
    .filter((d) => d.estado === "disponivel" || d.estado === "concluido")
    .sort((a, b) => Number(a.estado === "concluido") - Number(b.estado === "concluido"))
    .map((d) => ({
      id: d.id,
      titulo: d.titulo,
      grupo: `Seção ${niveis.get(d.level_id)?.ordem ?? ""} · ${unidades.get(d.unit_id)?.titulo ?? ""}`,
      proximo: d.estado === "disponivel",
      duracao_s: d.duracao_s,
    }));

  return <ListaHives hives={(hives.data as DadosHive[] | null) ?? []} opcoes={opcoes} euId={sessao.usuarioId} />;
}

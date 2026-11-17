import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import type { Metodo } from "@/dominio/metodos";
import type { DadosTrilha } from "@/dominio/trilha";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { Desafio, type BlocoDesafio } from "./Desafio";

export const metadata: Metadata = { title: "Desafio · Hive Break" };

export default async function PaginaDesafio({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const { id } = await params;
  if (!/^[a-z0-9_]+$/.test(id)) notFound();
  const sessao = await exigirCadastroCompleto();

  const [trilha, blocos, exercicios, metodo] = await Promise.all([
    sessao.supabase.rpc("ler_trilha"),
    sessao.supabase.from("challenge_blocks").select("ordem,exercise_id,parametros_por_dificuldade").eq("challenge_id", id).order("ordem"),
    sessao.supabase.from("exercises").select("id,nome,camera"),
    // Sem a migração 0008 a coluna não existe: o app usa o tempo de cada exercício (método legado).
    sessao.supabase.from("challenges").select("metodo").eq("id", id).maybeSingle(),
  ]);
  const dados = trilha.data as DadosTrilha | null;
  const desafio = dados?.desafios.find((d) => d.id === id);
  if (!dados || !desafio) notFound();
  // Bloqueado ou travado pela triagem: volta para a trilha.
  if (desafio.estado === "bloqueado" || desafio.estado === "travado") redirect("/trilha");

  const nomes = new Map((exercicios.data ?? []).map((e) => [e.id as string, e as { nome: string; camera: string }]));
  const lista: BlocoDesafio[] = (blocos.data ?? []).map((b) => ({
    ordem: Number(b.ordem),
    exercicioId: String(b.exercise_id),
    exercicio: nomes.get(b.exercise_id as string)?.nome ?? String(b.exercise_id),
    lateral: nomes.get(b.exercise_id as string)?.camera === "lateral",
    segundos: Number((b.parametros_por_dificuldade as { padrao?: { segundos?: number } }).padrao?.segundos ?? 60),
  }));
  const unidade = dados.unidades.find((u) => u.id === desafio.unit_id);
  const nivel = dados.niveis.find((n) => n.id === desafio.level_id);

  return (
    <Desafio
      id={desafio.id}
      titulo={desafio.titulo}
      modalidade={desafio.modalidade}
      contexto={`Seção ${nivel?.ordem ?? ""} · Unidade ${unidade?.ordem ?? ""} · ${unidade?.titulo ?? ""}`}
      xp={desafio.xp}
      equipamento={desafio.equipamento}
      jaFeito={desafio.estado === "concluido"}
      blocos={lista}
      metodo={metodo.error ? null : ((metodo.data?.metodo as Metodo | null) ?? null)}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sobrelinha } from "@/componentes/estilos";
import { CONCORDANCIA_MINIMA, leitura, PESSOAS_MINIMAS, relatorio, type SerieCalibracao } from "@/dominio/calibracao";
import { EXERCICIOS, ehSustentacao } from "@/exercicios";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { ApagarSerie } from "./ApagarSerie";
import { Calibrar, type ExercicioCalibravel } from "./Calibrar";

export const metadata: Metadata = { title: "Calibração · Admin · Hive Break", robots: { index: false } };
export const dynamic = "force-dynamic";

type SerieListada = SerieCalibracao & { criado_em: string; posicao_celular: string | null; fps_medio: number | null; observacao: string | null };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Só quem está em ADMINS: o aluno treina com a câmera e o professor conta junto (Etapa C). */
export default async function AdminCalibracao() {
  const sessao = await exigirCadastroCompleto();
  const { data: admin } = await sessao.supabase.rpc("lembretes_sou_admin");
  if (admin !== true) notFound();
  const { data } = await sessao.supabase.rpc("calibracao_listar");
  const series = (data ?? []) as SerieListada[];
  const linhas = relatorio(series);

  const exercicios: ExercicioCalibravel[] = EXERCICIOS.filter((d) => d.formato !== "respiracao").map((d) => ({
    id: d.id,
    nome: d.nome,
    tipo: ehSustentacao(d) ? "tempo" : "reps",
    camera: d.camera,
    calibrado: (d as { catalogo?: { calibrado?: boolean } }).catalogo?.calibrado === true,
  }));
  const nomes = new Map(exercicios.map((e) => [e.id, e]));

  return (
    <main className="flex flex-col gap-6 px-5 pb-12 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Admin</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Calibração</h1>
        <p className="mt-2 text-[15px] text-apagado">
          O aluno treina com a câmera e você conta junto. O app compara as duas contagens. Exercício com {PESSOAS_MINIMAS} pessoas
          acima de {pct(CONCORDANCIA_MINIMA)} fica pronto para virar calibrado. Nenhuma imagem é gravada.
        </p>
      </header>

      <Calibrar exercicios={exercicios} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-black">Relatório por exercício</h2>
        {linhas.length === 0 ? (
          <p className="text-sm text-apagado">Nenhuma série ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {linhas.map((r) => {
              const ex = nomes.get(r.exercicioId);
              return (
                <li key={r.exercicioId} className={`rounded-2xl border p-4 ${r.pronto ? "border-mel" : "border-borda"}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-bold">{ex?.nome ?? r.exercicioId}</p>
                    <p className={`fonte-numero text-2xl ${r.concordanciaMedia >= CONCORDANCIA_MINIMA ? "text-mel" : "text-texto"}`}>
                      {pct(r.concordanciaMedia)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-apagado">
                    {r.pessoasAprovadas} de {PESSOAS_MINIMAS} pessoas aprovadas · {r.pessoas} {r.pessoas === 1 ? "pessoa" : "pessoas"} ·{" "}
                    {r.series} {r.series === 1 ? "série" : "séries"} · app contou a mais em {r.appContouAMais}, a menos em {r.appContouAMenos}
                    {ex?.calibrado ? " · já calibrado no catálogo" : ""}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{leitura(r)}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {series.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-black">Séries gravadas</h2>
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda">
            {series.slice(0, 60).map((s) => {
              const app = s.tipo === "reps" ? `${s.app_reps ?? 0}` : `${Number(s.app_tempo_s ?? 0).toFixed(1)} s`;
              const prof = s.tipo === "reps" ? `${s.prof_reps ?? 0}` : `${Number(s.prof_tempo_s ?? 0).toFixed(1)} s`;
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{nomes.get(s.exercicio_id)?.nome ?? s.exercicio_id} · {s.pessoa}</p>
                    <p className="truncate text-apagado">
                      App {app} · Você {prof} · {quando(s.criado_em)}
                      {s.fps_medio ? ` · ${Math.round(Number(s.fps_medio))} fps` : ""}
                      {s.posicao_celular ? ` · ${s.posicao_celular}` : ""}
                    </p>
                  </div>
                  <ApagarSerie id={s.id} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}

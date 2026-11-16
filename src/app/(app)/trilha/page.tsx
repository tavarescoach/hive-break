import type { Metadata } from "next";
import { cartao, sobrelinha } from "@/componentes/estilos";
import { EQUIPAMENTOS, rotuloDe } from "@/dominio/perfil";
import { exigirCadastroCompleto } from "@/lib/sessao";

export const metadata: Metadata = { title: "Trilha · Hive Break" };

interface Nivel {
  id: number;
  ordem: number;
  tema: string;
  equipamentos_necessarios: string[];
}

export default async function Trilha() {
  const sessao = await exigirCadastroCompleto();
  const { perfil, ofensiva } = sessao;
  const { data } = await sessao.supabase.from("levels").select("id,ordem,tema,equipamentos_necessarios").order("ordem");
  const niveis = (data ?? []) as Nivel[];
  const metaXp = (perfil.meta_desafios_dia ?? 1) * 10;
  const compromisso = ofensiva.meta_compromisso ?? 7;

  return (
    <main className="flex flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className={sobrelinha}>Trilha</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">Oi, {perfil.apelido}!</h1>
        </div>
        <div className="flex gap-2">
          <p className="rounded-xl border border-borda bg-superficie px-3 py-2 text-center leading-tight" aria-label={`Ofensiva de ${ofensiva.atual} dias`}>
            <span className="block text-xl font-black tabular-nums text-mel">{ofensiva.atual}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-apagado">ofensiva</span>
          </p>
          <p className="rounded-xl border border-borda bg-superficie px-3 py-2 text-center leading-tight" aria-label={`0 de ${metaXp} XP hoje`}>
            <span className="block text-xl font-black tabular-nums">0<span className="text-sm text-apagado">/{metaXp}</span></span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-apagado">XP hoje</span>
          </p>
        </div>
      </header>

      <section className={cartao}>
        <p className="text-lg font-bold leading-tight">Seu compromisso: {compromisso} dias seguidos</p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuemin={0} aria-valuemax={compromisso} aria-valuenow={Math.min(ofensiva.atual, compromisso)} aria-label="Progresso do compromisso">
          <div className="h-full rounded-full bg-mel" style={{ width: `${Math.min(100, (ofensiva.atual / compromisso) * 100)}%` }} />
        </div>
        <p className="mt-2 text-[15px] text-apagado">
          {ofensiva.atual} de {compromisso} dias. Um desafio por dia mantém a chama acesa.
        </p>
      </section>

      <section className={`${cartao} border-mel/50`}>
        <p className="text-lg font-bold leading-tight">Os desafios estão chegando</p>
        <p className="mt-1 text-[15px] leading-relaxed text-apagado">
          Seu cadastro está pronto e o Nível 1 já está liberado. Os desafios entram nas próximas versões do teste.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold">Os 8 níveis</h2>
        <ol className="mt-3 flex flex-col gap-2.5">
          {niveis.map((nivel) => {
            const atual = nivel.id === perfil.nivel_atual;
            return (
              <li
                key={nivel.id}
                aria-current={atual ? "step" : undefined}
                className={`flex items-center gap-4 rounded-2xl border px-4 py-3 ${atual ? "border-mel bg-mel/10" : "border-borda bg-superficie opacity-70"}`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${atual ? "bg-mel text-black" : "bg-superficie-2 text-apagado"}`}>
                  {nivel.ordem}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold leading-tight">{nivel.tema}</p>
                  <p className="text-sm text-apagado">
                    {nivel.equipamentos_necessarios.length === 0
                      ? "Sem equipamento"
                      : nivel.equipamentos_necessarios.map((e) => rotuloDe(EQUIPAMENTOS, e)).join(" + ")}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${atual ? "text-mel" : "text-apagado"}`}>{atual ? "Você está aqui" : "Bloqueado"}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

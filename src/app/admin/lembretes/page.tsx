import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sobrelinha } from "@/componentes/estilos";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { Disparar } from "./Disparar";

export const metadata: Metadata = { title: "Lembretes · Admin · Hive Break", robots: { index: false } };
export const dynamic = "force-dynamic";

interface Envio {
  id: number;
  criado_em: string;
  enviado_em: string | null;
  aberto_em: string | null;
  gatilho: string;
  canal: string;
  status: string;
  erro: string | null;
  assunto: string | null;
  texto: string | null;
  desafio_em_2h: boolean | null;
  pessoa: string;
}

const COR_STATUS: Record<string, string> = {
  enviado: "text-mel",
  reservado: "text-texto",
  simulado: "text-apagado",
  falhou: "text-red-400",
};

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/** Só quem está em ADMINS (lembretes_config): últimos envios e disparo de teste. */
export default async function AdminLembretes() {
  const sessao = await exigirCadastroCompleto();
  const { data: admin } = await sessao.supabase.rpc("lembretes_sou_admin");
  if (admin !== true) notFound();
  const { data } = await sessao.supabase.rpc("lembretes_admin_log", { p_limite: 100 });
  const { simular, envios, gatilhos } = (data ?? { simular: true, envios: [], gatilhos: [] }) as {
    simular: boolean;
    envios: Envio[];
    gatilhos: string[];
  };

  return (
    <main className="flex flex-col gap-5 px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Admin</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Lembretes</h1>
        <p className="mt-2 text-[15px] text-apagado">
          {simular
            ? "Simulação ligada: o motor grava 'simulado' e não envia nada. Disparos de teste saem de verdade."
            : "Simulação desligada: os lembretes estão sendo enviados."}
        </p>
      </header>

      <Disparar gatilhos={gatilhos} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-black">Últimos envios</h2>
        {envios.length === 0 && <p className="text-apagado">Nada por aqui ainda.</p>}
        <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda">
          {envios.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
              <p className="flex flex-wrap items-baseline gap-x-2 font-bold">
                <span className="font-mono">{e.gatilho}</span>
                <span>{e.canal}</span>
                <span className={COR_STATUS[e.status] ?? ""}>{e.status}</span>
                <span className="font-normal text-apagado">
                  {quando(e.criado_em)} · {e.pessoa}
                </span>
              </p>
              {e.assunto && <p>{e.assunto}</p>}
              {e.texto && <p className="line-clamp-2 whitespace-pre-line text-apagado">{e.texto}</p>}
              {e.erro && <p className="text-red-400">{e.erro}</p>}
              {(e.aberto_em || e.desafio_em_2h) && (
                <p className="text-apagado">
                  {e.aberto_em && `Aberto ${quando(e.aberto_em)}`}
                  {e.aberto_em && e.desafio_em_2h && " · "}
                  {e.desafio_em_2h && "Desafio em até 2 h"}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

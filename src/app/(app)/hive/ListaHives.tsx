"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { criarHive } from "@/app/hive/acoes";
import { Hexagono } from "@/app/hive/AoVivo";
import { botaoPrimario, botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { relogio, segundosAte, type DadosHive } from "@/dominio/hive";

export interface OpcaoDesafio {
  id: string;
  titulo: string;
  grupo: string;
  /** Liberado e ainda não feito (o próximo da trilha). */
  proximo: boolean;
  duracao_s: number;
}

/** Atualiza a lista a cada 10 s e o relógio dos cards a cada segundo. */
function useAtualizacao() {
  const router = useRouter();
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const lista = setInterval(() => router.refresh(), 10_000);
    return () => {
      clearInterval(relogio);
      clearInterval(lista);
    };
  }, [router]);
  return agora;
}

export function ListaHives({ hives, opcoes, euId }: { hives: DadosHive[]; opcoes: OpcaoDesafio[]; euId: string }) {
  const agora = useAtualizacao();
  const [criando, setCriando] = useState(false);
  const aoVivo = hives.filter((h) => h.status !== "encerrada");
  const recentes = hives.filter((h) => h.status === "encerrada");

  return (
    <main className="flex flex-col gap-5 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className={sobrelinha}>Hive</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">Bora um break junto?</h1>
        </div>
        {aoVivo.length > 0 && (
          <p className="shrink-0 pb-1 text-sm font-bold text-mel">
            <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-mel align-middle" />
            {aoVivo.length} ao vivo
          </p>
        )}
      </header>

      {criando ? (
        <NovaHive opcoes={opcoes} aoCancelar={() => setCriando(false)} />
      ) : (
        <button onClick={() => setCriando(true)} className={botaoPrimario}>
          Começar uma hive
        </button>
      )}

      <section aria-label="Hives ao vivo" className="flex flex-col gap-3">
        {aoVivo.length === 0 ? (
          <div className={`${cartao} text-center`}>
            <p className="text-lg font-black">Ninguém hiving agora</p>
            <p className="mt-1 text-[15px] leading-relaxed text-apagado">
              Comece uma hive e chame sua galera no WhatsApp. Quem tiver o app vê aqui e dá join.
            </p>
          </div>
        ) : (
          aoVivo.map((h) => <CartaoHive key={h.id} hive={h} agora={agora} euId={euId} />)
        )}
      </section>

      {recentes.length > 0 && (
        <section aria-label="Suas hives recentes" className="flex flex-col gap-2">
          <h2 className="text-base font-bold">Suas hives da última hora</h2>
          {recentes.map((h) => (
            <Link key={h.id} href={`/hive/${h.id}`} className={`${cartao} flex items-center justify-between gap-3 py-3`}>
              <span className="min-w-0">
                <span className="block truncate font-bold">{h.desafio}</span>
                <span className="block text-sm text-apagado">{h.participantes.length} pessoas · ver resultado</span>
              </span>
              <span aria-hidden className="text-apagado">›</span>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function CartaoHive({ hive, agora, euId }: { hive: DadosHive; agora: number; euId: string }) {
  const sala = hive.status === "sala";
  const quem = hive.anfitriao_id === euId ? "Você começou" : `${hive.anfitriao ?? "Alguém"} começou`;
  const faltam = segundosAte(sala ? hive.inicio_em : hive.fim_em, agora);
  const visiveis = hive.participantes.slice(0, 5);
  const extra = hive.participantes.length - visiveis.length;
  return (
    <article className={`${cartao} ${sala ? "border-mel" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate font-bold">{quem}</p>
        <p className={`shrink-0 text-sm font-bold ${sala ? "text-mel" : "text-apagado"}`}>{sala ? "sala aberta" : "em andamento"}</p>
      </div>
      <p className="text-[15px] text-apagado">
        {hive.desafio} · {relogio(hive.duracao_s)}
        {hive.amigo && hive.anfitriao_id !== euId ? " · amigo" : ""}
        {hive.modo_competicao ? " · competição" : ""}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" aria-label={`${hive.participantes.length} na hive`}>
          {visiveis.map((p) => (
            <Hexagono key={p.id} nome={p.apelido} url={p.avatar_url} tamanho={26} destaque={p.id === hive.anfitriao_id} />
          ))}
          {extra > 0 && <span className="ml-1 text-sm font-bold text-apagado">+{extra}</span>}
        </div>
        <p className="text-sm font-semibold tabular-nums text-apagado">
          {sala ? `começa em ${relogio(faltam)}` : `fecha em ${relogio(faltam)}`}
        </p>
      </div>
      <Link href={`/hive/${hive.id}`} className={`${sala ? botaoPrimario : botaoSecundario} mt-3`}>
        {hive.sou_participante ? "Voltar para a hive" : "Join"}
      </Link>
    </article>
  );
}

function NovaHive({ opcoes, aoCancelar }: { opcoes: OpcaoDesafio[]; aoCancelar: () => void }) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState(opcoes[0]?.id ?? "");
  const [competicao, setCompeticao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, iniciar] = useTransition();

  const abrir = () =>
    iniciar(async () => {
      setErro(null);
      const r = await criarHive(escolhido, competicao);
      if (!r.ok || !r.id) return setErro(r.erro ?? "Não consegui abrir a sala.");
      router.push(`/hive/${r.id}`);
    });

  if (opcoes.length === 0) {
    return (
      <section className={cartao}>
        <p className="text-[15px] leading-relaxed">Faça o primeiro desafio da trilha para poder começar uma hive.</p>
        <button onClick={aoCancelar} className={`${botaoSecundario} mt-3`}>Fechar</button>
      </section>
    );
  }

  return (
    <section className={`${cartao} flex flex-col gap-3`} aria-label="Começar uma hive">
      <label className="flex flex-col gap-1.5">
        <span className="font-bold">Qual desafio?</span>
        <select
          value={escolhido}
          onChange={(e) => setEscolhido(e.target.value)}
          className="h-14 w-full rounded-xl border border-borda bg-fundo px-3 text-base font-semibold text-texto"
        >
          {opcoes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.proximo ? "Próximo · " : ""}{o.titulo} · {relogio(o.duracao_s)} ({o.grupo})
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block font-bold">Modo competição</span>
          <span className="block text-sm text-apagado">Os reps de todos aparecem ao vivo</span>
        </span>
        <input type="checkbox" checked={competicao} onChange={(e) => setCompeticao(e.target.checked)} className="h-6 w-6 accent-[#ffc42e]" />
      </label>
      <p className="text-sm leading-relaxed text-apagado">A sala fica aberta 60 s para a galera entrar. Você pode começar antes.</p>
      {erro && <p role="alert" className="text-[15px] text-ruim">{erro}</p>}
      <button onClick={abrir} disabled={abrindo || !escolhido} className={botaoPrimario}>
        {abrindo ? "Abrindo…" : "Abrir a sala"}
      </button>
      <button onClick={aoCancelar} className={botaoSecundario}>Cancelar</button>
    </section>
  );
}

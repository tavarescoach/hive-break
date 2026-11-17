"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { prepararSom, som } from "@/camera/som";
import { botaoPrimario, botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { formatarDuracao, ROTULO_EQUIPAMENTO, ROTULO_MODALIDADE } from "@/dominio/trilha";
import { concluirDesafio, type ResultadoDesafio } from "./acoes";

export interface BlocoTimer {
  exercicio: string;
  lateral: boolean;
  segundos: number;
}

interface Props {
  id: string;
  titulo: string;
  modalidade: string;
  contexto: string;
  xp: number;
  equipamento: string | null;
  jaFeito: boolean;
  blocos: BlocoTimer[];
}

type Etapa = "pronto" | "rodando" | "pausado" | "tempo";

const relogio = (segundos: number) => `${Math.floor(segundos / 60)}:${String(Math.max(0, segundos) % 60).padStart(2, "0")}`;

/**
 * Tela provisória do desafio, enquanto a câmera não valida os exercícios:
 * um timer que percorre os exercícios e o botão "Concluí".
 */
export function TimerDesafio({ id, titulo, modalidade, contexto, xp, equipamento, jaFeito, blocos }: Props) {
  const total = blocos.reduce((s, b) => s + b.segundos, 0);
  const [etapa, setEtapa] = useState<Etapa>("pronto");
  const [decorrido, setDecorrido] = useState(0);
  const [resultado, setResultado] = useState<ResultadoDesafio | null>(null);
  const [enviando, iniciar] = useTransition();
  const anterior = useRef({ bloco: 0, segundo: 0 });

  // Em qual exercício o timer está.
  let acumulado = 0;
  let indice = blocos.length - 1;
  for (let i = 0; i < blocos.length; i++) {
    if (decorrido < acumulado + blocos[i].segundos) {
      indice = i;
      break;
    }
    acumulado += blocos[i].segundos;
  }
  const bloco = blocos[indice];
  const restanteBloco = etapa === "tempo" ? 0 : Math.max(0, acumulado + bloco.segundos - decorrido);
  const fracao = bloco.segundos ? 1 - restanteBloco / bloco.segundos : 1;

  useEffect(() => {
    if (etapa !== "rodando") return;
    const inicio = performance.now() - decorrido * 1000;
    const relogioId = window.setInterval(() => {
      const agora = Math.floor((performance.now() - inicio) / 1000);
      if (agora >= total) {
        setDecorrido(total);
        setEtapa("tempo");
        som.fim();
      } else {
        setDecorrido(agora);
      }
    }, 200);
    return () => window.clearInterval(relogioId);
    // `decorrido` só importa no momento em que o timer (re)começa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, total]);

  // Sons: troca de exercício e os 3 últimos segundos de cada um.
  useEffect(() => {
    if (etapa !== "rodando") return;
    if (indice !== anterior.current.bloco) som.largada();
    else if (restanteBloco <= 3 && restanteBloco > 0 && restanteBloco !== anterior.current.segundo) som.tique();
    anterior.current = { bloco: indice, segundo: restanteBloco };
  }, [etapa, indice, restanteBloco]);

  // Tela acesa enquanto o timer roda.
  useEffect(() => {
    if (etapa !== "rodando") return;
    let trava: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((t) => (trava = t)).catch(() => {});
    return () => void trava?.release().catch(() => {});
  }, [etapa]);

  const concluir = () => {
    iniciar(async () => {
      const r = await concluirDesafio(id);
      setResultado(r);
      if (r.ok) setEtapa("pausado");
    });
  };

  if (resultado?.ok) {
    return (
      <main className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div role="status" className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <p className={sobrelinha}>{resultado.nivel_concluido ? "Seção concluída" : resultado.unidade_concluida ? "Unidade concluída" : "Desafio concluído"}</p>
          <p className="text-[5.5rem] font-black leading-none text-mel tabular-nums">+{resultado.xp}</p>
          <p className="-mt-3 text-2xl font-black">XP</p>
          <p className="max-w-[18rem] text-base leading-relaxed text-apagado">
            {resultado.repetido
              ? "Você já tinha feito este desafio hoje, então ele não soma XP de novo. O treino valeu do mesmo jeito."
              : resultado.primeiro_do_dia
                ? "Inclui +5 XP pelo primeiro desafio do dia."
                : "Mais um para a conta de hoje."}
          </p>
          <div className={`${cartao} w-full`}>
            <p className="text-lg font-black">
              Ofensiva: {resultado.ofensiva} {resultado.ofensiva === 1 ? "dia" : "dias"}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-apagado">
              {resultado.nivel_concluido
                ? resultado.proximo_nivel
                  ? `Você fechou a seção e ganhou +30 XP. A Seção ${resultado.proximo_nivel} está liberada.`
                  : "Você fechou a última seção da trilha. Parabéns!"
                : resultado.unidade_concluida
                  ? "Unidade fechada. A próxima já está liberada na trilha."
                  : "O próximo desafio já está liberado na trilha."}
            </p>
          </div>
        </div>
        <Link href="/trilha" className={botaoPrimario}>
          Continuar
        </Link>
      </main>
    );
  }

  const raio = 120;
  const perimetro = 2 * Math.PI * raio;

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-start gap-2">
        <Link href="/trilha" aria-label="Voltar para a trilha" className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-apagado active:bg-superficie">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <div className="min-w-0 pt-1">
          <p className="truncate text-[12px] font-black uppercase tracking-[0.12em] text-apagado">{contexto}</p>
          <h1 className="text-2xl font-black leading-tight">{titulo}</h1>
          <p className="text-sm text-apagado">
            {[ROTULO_MODALIDADE[modalidade] !== titulo ? ROTULO_MODALIDADE[modalidade] : null, formatarDuracao(total), `+${xp} XP`, equipamento ? ROTULO_EQUIPAMENTO[equipamento] : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      {etapa === "pronto" ? (
        <>
          <section className="mt-6 flex-1">
            <h2 className="text-base font-bold">Neste desafio</h2>
            <ol className="mt-3 flex flex-col gap-2.5">
              {blocos.map((b, i) => (
                <li key={i} className={`${cartao} flex items-center gap-3 py-3`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mel/15 text-lg font-black text-mel">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{b.exercicio}</p>
                    <p className="text-sm text-apagado">{formatarDuracao(b.segundos)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[15px] leading-relaxed text-apagado">
              Por enquanto a câmera ainda não confere estes exercícios: siga o timer e toque em Concluí quando terminar.
              {jaFeito ? " Você já fez este desafio; refazer no mesmo dia não soma XP de novo." : ""}
            </p>
          </section>
          <button
            onClick={() => {
              prepararSom();
              som.largada();
              setEtapa("rodando");
            }}
            className={botaoPrimario}
          >
            Começar
          </button>
        </>
      ) : (
        <>
          <section className="flex flex-1 flex-col items-center justify-center gap-5">
            <p className="text-sm font-black uppercase tracking-[0.12em] text-apagado">
              Exercício {indice + 1} de {blocos.length}
            </p>
            <h2 className="-mt-3 text-center text-3xl font-black leading-tight text-balance">{etapa === "tempo" ? "Tempo!" : bloco.exercicio}</h2>
            <div className="relative" role="timer" aria-label={`Faltam ${relogio(restanteBloco)} neste exercício`}>
              <svg width="264" height="264" viewBox="0 0 264 264" aria-hidden>
                <circle cx="132" cy="132" r={raio} fill="none" stroke="var(--color-superficie-2)" strokeWidth="14" />
                <circle
                  cx="132" cy="132" r={raio} fill="none" stroke="var(--color-mel)" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - fracao)} transform="rotate(-90 132 132)"
                />
              </svg>
              <p className="absolute inset-0 flex items-center justify-center text-[5rem] font-black tabular-nums leading-none">{relogio(restanteBloco)}</p>
            </div>
            <p className="min-h-6 text-base text-apagado">
              {etapa === "tempo"
                ? "Toque em Concluí para ganhar o XP."
                : indice < blocos.length - 1
                  ? `A seguir: ${blocos[indice + 1].exercicio}`
                  : `Último exercício · faltam ${relogio(total - decorrido)} no total`}
            </p>
          </section>
          {resultado?.erro && (
            <p role="alert" className="mb-3 rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">
              {resultado.erro}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <button onClick={concluir} disabled={enviando} className={botaoPrimario}>
              {enviando ? "Registrando…" : "Concluí"}
            </button>
            {etapa !== "tempo" && (
              <button onClick={() => setEtapa(etapa === "rodando" ? "pausado" : "rodando")} className={botaoSecundario}>
                {etapa === "rodando" ? "Pausar" : "Continuar o timer"}
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}

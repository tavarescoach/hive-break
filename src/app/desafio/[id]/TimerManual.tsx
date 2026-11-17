"use client";

import { useEffect, useRef, useState } from "react";
import { som } from "@/camera/som";
import { botaoPrimario, botaoSecundario, cartao } from "@/componentes/estilos";
import type { BlocoDesafio } from "./Desafio";

const relogio = (segundos: number) => `${Math.floor(segundos / 60)}:${String(Math.max(0, segundos) % 60).padStart(2, "0")}`;

/**
 * Modo sem câmera (seção 3.5): um timer percorre os exercícios e a pessoa
 * confirma com "Concluí". Vale metade do XP e não pontua na liga.
 */
export function TimerManual({
  blocos, aviso, enviando, erro, aoConcluir,
}: {
  blocos: BlocoDesafio[];
  aviso: string | null;
  enviando: boolean;
  erro: string | null;
  aoConcluir: () => void;
}) {
  const total = blocos.reduce((s, b) => s + b.segundos, 0);
  const [rodando, setRodando] = useState(true);
  const [decorrido, setDecorrido] = useState(0);
  const anterior = useRef({ bloco: 0, segundo: 0 });
  const acabou = decorrido >= total;

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
  const restante = acabou ? 0 : Math.max(0, acumulado + bloco.segundos - decorrido);
  const fracao = bloco.segundos ? 1 - restante / bloco.segundos : 1;

  useEffect(() => {
    if (!rodando || acabou) return;
    const inicio = performance.now() - decorrido * 1000;
    const id = window.setInterval(() => {
      const agora = Math.floor((performance.now() - inicio) / 1000);
      if (agora >= total) {
        setDecorrido(total);
        som.fim();
      } else {
        setDecorrido(agora);
      }
    }, 200);
    return () => window.clearInterval(id);
    // `decorrido` só importa no momento em que o timer (re)começa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando, acabou, total]);

  useEffect(() => {
    if (!rodando || acabou) return;
    if (indice !== anterior.current.bloco) som.largada();
    else if (restante <= 3 && restante > 0 && restante !== anterior.current.segundo) som.tique();
    anterior.current = { bloco: indice, segundo: restante };
  }, [rodando, acabou, indice, restante]);

  useEffect(() => {
    if (!rodando || acabou) return;
    let trava: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((t) => (trava = t)).catch(() => {});
    return () => void trava?.release().catch(() => {});
  }, [rodando, acabou]);

  const raio = 112;
  const perimetro = 2 * Math.PI * raio;

  return (
    <>
      {aviso && (
        <p role="alert" className={`${cartao} mt-4 border-atencao/60 text-[15px] leading-relaxed`}>
          {aviso} Seguimos sem câmera: você confirma no final e ganha metade do XP.
        </p>
      )}
      <section className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
        <p className="text-sm font-black uppercase tracking-[0.12em] text-apagado">
          Exercício {indice + 1} de {blocos.length} · sem câmera
        </p>
        <h2 className="-mt-2 text-center text-3xl font-black leading-tight text-balance">{acabou ? "Tempo!" : bloco.exercicio}</h2>
        <div className="relative" role="timer" aria-label={`Faltam ${relogio(restante)} neste exercício`}>
          <svg width="248" height="248" viewBox="0 0 248 248" aria-hidden>
            <circle cx="124" cy="124" r={raio} fill="none" stroke="var(--color-superficie-2)" strokeWidth="14" />
            <circle cx="124" cy="124" r={raio} fill="none" stroke="var(--color-mel)" strokeWidth="14" strokeLinecap="round" strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - fracao)} transform="rotate(-90 124 124)" />
          </svg>
          <p className="absolute inset-0 flex items-center justify-center text-[4.5rem] font-black tabular-nums leading-none">{relogio(restante)}</p>
        </div>
        <p className="min-h-6 text-base text-apagado">
          {acabou ? "Toque em Concluí para ganhar o XP." : indice < blocos.length - 1 ? `A seguir: ${blocos[indice + 1].exercicio}` : `Último exercício · faltam ${relogio(total - decorrido)} no total`}
        </p>
      </section>
      {erro && (
        <p role="alert" className="mb-3 rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">
          {erro}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <button onClick={aoConcluir} disabled={enviando} className={botaoPrimario}>
          {enviando ? "Registrando…" : "Concluí"}
        </button>
        {!acabou && (
          <button onClick={() => setRodando((v) => !v)} className={botaoSecundario}>
            {rodando ? "Pausar" : "Continuar o timer"}
          </button>
        )}
      </div>
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { darHighFive } from "./acoes";

/** High five no feed de amigos (docs/PERFIL.md, seção 3.3): 1 por pessoa por dia. */
export function BotaoHighFive({ paraId, inicialDado, inicialTotal }: { paraId: string; inicialDado: boolean; inicialTotal: number }) {
  const [dado, setDado] = useState(inicialDado);
  const [total, setTotal] = useState(inicialTotal);
  const [pendente, iniciar] = useTransition();

  const dar = () => {
    if (dado) return;
    setDado(true);
    setTotal((t) => t + 1);
    iniciar(async () => {
      const r = await darHighFive(paraId);
      if (!r.ok) {
        setDado(false);
        setTotal((t) => t - 1);
      }
    });
  };

  return (
    <button
      onClick={dar}
      disabled={dado || pendente}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${dado ? "border-mel text-mel" : "border-borda text-apagado"}`}
    >
      🙌 {dado ? "Você deu high five" : "High five"}
      {total > 0 && <span className="tabular-nums">· {total}</span>}
    </button>
  );
}

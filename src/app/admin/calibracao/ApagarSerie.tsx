"use client";

import { useTransition } from "react";
import { apagarSerie } from "./acoes";

/** Apaga uma série gravada por engano (pede confirmação com um segundo toque). */
export function ApagarSerie({ id }: { id: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      disabled={pendente}
      onClick={() => {
        if (window.confirm("Apagar esta série? Não dá para desfazer.")) iniciar(async () => void (await apagarSerie(id)));
      }}
      className="h-11 shrink-0 rounded-full border border-borda px-3 text-xs font-bold text-apagado active:bg-fundo disabled:opacity-40"
    >
      {pendente ? "…" : "Apagar"}
    </button>
  );
}

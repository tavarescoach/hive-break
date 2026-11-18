"use client";

import { useEffect, useRef, useState } from "react";
import { botaoPrimario, botaoSecundario } from "@/componentes/estilos";
import {
  PERGUNTAS_PRONTIDAO, TERMO_RESPONSABILIDADE, TEXTO_CIENTE, TEXTO_DECLARACAO, TEXTO_RESTRICAO,
} from "@/dominio/declaracao-saude";

/**
 * Dois pop-ups rápidos antes do 1º desafio (decisão do Luan, 18/11/2026):
 *   1. questionário de prontidão: "Declaro que respondo NÃO a todas" ou "Respondo SIM a alguma";
 *   2. termo de responsabilidade: só segue depois de "Li e estou ciente".
 * Fechar qualquer um volta para a tela de antes, sem liberar nada.
 */
export function DeclaracaoSaude({
  aberto, aoFechar, aoConfirmar, ocupado, erro,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Chamado só depois do termo confirmado. */
  aoConfirmar: (todasNao: boolean) => void;
  ocupado?: boolean;
  erro?: string | null;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [passo, setPasso] = useState<"perguntas" | "termo">("perguntas");
  const [todasNao, setTodasNao] = useState(true);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (aberto && !d.open) {
      setPasso("perguntas");
      d.showModal();
    } else if (!aberto && d.open) d.close();
  }, [aberto]);

  const responder = (nao: boolean) => {
    setTodasNao(nao);
    setPasso("termo");
  };

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault();
        if (!ocupado) aoFechar();
      }}
      aria-labelledby="declaracao-titulo"
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-borda bg-fundo p-5 text-texto backdrop:bg-black/70"
    >
      {passo === "perguntas" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mel">1 de 2 · Segurança</p>
          <h2 id="declaracao-titulo" className="text-2xl font-black leading-tight">Questionário de prontidão</h2>
          <ol className="flex flex-col gap-2.5">
            {PERGUNTAS_PRONTIDAO.map((p, i) => (
              <li key={p} className="flex gap-3 rounded-2xl border border-borda bg-superficie px-4 py-3 text-base font-semibold leading-snug">
                <span className="text-mel">{i + 1}.</span>
                {p}
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={() => responder(true)} className={botaoPrimario}>Respondo NÃO a todas</button>
            <button type="button" onClick={() => responder(false)} className={botaoSecundario}>Respondo SIM a alguma</button>
            <button type="button" onClick={aoFechar} className="h-12 text-[15px] font-semibold text-apagado underline underline-offset-4">Voltar</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mel">2 de 2 · Responsabilidade</p>
          <h2 id="declaracao-titulo" className="text-2xl font-black leading-tight">Termo de responsabilidade</h2>
          {todasNao ? (
            <p className="rounded-2xl border border-bom/50 bg-bom/10 px-4 py-3 text-[15px] font-semibold leading-snug">{TEXTO_DECLARACAO}</p>
          ) : (
            <p role="status" className="rounded-2xl border border-atencao/60 bg-atencao/10 px-4 py-3 text-[15px] font-semibold leading-snug">
              {TEXTO_RESTRICAO}
            </p>
          )}
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] leading-relaxed text-apagado">
            {TERMO_RESPONSABILIDADE.map((t) => <li key={t}>{t}</li>)}
          </ul>
          {erro && <p role="alert" className="rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">{erro}</p>}
          <div className="flex flex-col gap-2.5">
            <button type="button" onClick={() => aoConfirmar(todasNao)} disabled={ocupado} className={botaoPrimario}>
              {ocupado ? "Preparando…" : TEXTO_CIENTE}
            </button>
            <button type="button" onClick={() => setPasso("perguntas")} disabled={ocupado} className="h-12 text-[15px] font-semibold text-apagado underline underline-offset-4">
              Voltar
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { type CandidatoResgate, buscarPopupResgate, dispensarResgate } from "@/app/resgate/acoes";
import { FolhaResgate } from "@/app/resgate/FolhaResgate";
import { Avatar } from "./Avatar";
import { botaoPrimario, botaoSecundario } from "./estilos";

const HEXAGONO = "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)";

/**
 * Pop-up de resgate (docs/RESGATE.md, seção 3.1): monta sozinho, pede ao
 * servidor o candidato do dia (o servidor já aplica o limite de 1 por dia) e
 * só aparece se houver alguém. Usado tanto ao abrir o app quanto logo depois
 * de concluir um desafio.
 */
export function PopUpResgate() {
  const [candidato, setCandidato] = useState<CandidatoResgate | null>(null);
  const [chamando, setChamando] = useState(false);

  useEffect(() => {
    let vivo = true;
    buscarPopupResgate()
      .then((c) => vivo && setCandidato(c))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!candidato) return null;

  if (chamando) {
    return (
      <FolhaResgate
        amigoId={candidato.amigoId}
        apelido={candidato.apelido}
        appDisponivel={candidato.appDisponivel}
        aoFechar={() => setChamando(false)}
        aoEnviado={() => setCandidato(null)}
      />
    );
  }

  const dispensar = () => {
    void dispensarResgate(candidato.amigoId);
    setCandidato(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resgate"
      className="fixed inset-0 z-40 mx-auto flex w-full max-w-[430px] flex-col items-center justify-center gap-5 bg-fundo px-6 text-center"
    >
      <div className="relative h-24 w-24">
        <div className="h-full w-full grayscale" style={{ clipPath: HEXAGONO }}>
          <Avatar url={candidato.avatarUrl} nome={candidato.apelido} tamanho={96} />
        </div>
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-fundo bg-superficie-2 text-apagado"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2c-1.1 4.1-5 5.3-5 9.9a5 5 0 0 0 10 0c0-2-.9-3.1-2-4 .3 2-.9 2.9-1.9 1.9-.9-.9-1-3.2-1.1-7.8Z" />
          </svg>
        </span>
      </div>
      <h2 className="text-2xl font-black leading-tight">
        {candidato.apelido} está há {candidato.dias} {candidato.dias === 1 ? "dia" : "dias"} sem break
      </h2>
      <p className="text-base text-apagado">Um convite seu vale mais que qualquer lembrete.</p>
      <div className="mt-2 flex w-full flex-col gap-2.5">
        <button onClick={() => setChamando(true)} className={botaoPrimario}>
          Chamar {candidato.apelido}
        </button>
        <button onClick={dispensar} className={botaoSecundario}>
          Agora não
        </button>
      </div>
    </div>
  );
}

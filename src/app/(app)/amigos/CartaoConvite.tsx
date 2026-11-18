"use client";

import { useState, useSyncExternalStore } from "react";
import { botaoPrimario, botaoSecundario, cartao } from "@/componentes/estilos";
import { registrarConviteEnviado } from "./acoes";

const assinar = () => () => {};

/** Link pessoal de convite, compartilhado pelo menu nativo do celular (seção 3.4). */
export function CartaoConvite({ codigo }: { codigo: string }) {
  const origem = useSyncExternalStore(assinar, () => window.location.origin, () => "");
  const [copiado, setCopiado] = useState(false);
  const link = `${origem}/c/${codigo}`;
  const mensagem = `Estou treinando 5 minutos por dia no Hive Break. Bora junto? ${link}`;

  const avisarEnvio = () => void registrarConviteEnviado().catch(() => {});

  const copiar = async () => {
    avisarEnvio();
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem acesso à área de transferência: o link continua visível na tela.
    }
  };

  const compartilhar = async () => {
    if (!navigator.share) return copiar();
    avisarEnvio();
    try {
      await navigator.share({ text: mensagem });
    } catch {
      // A pessoa fechou o menu de compartilhar.
    }
  };

  return (
    <section className={`${cartao} border-mel/50`}>
      <p className="text-sm font-semibold text-apagado">Seu link de convite</p>
      <p className="mt-1 break-all font-mono text-[15px]">{origem ? link : `…/c/${codigo}`}</p>
      <p className="mt-3 text-sm text-apagado">
        Código: <span className="font-mono text-base font-bold tracking-widest text-texto">{codigo}</span>
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        <button onClick={compartilhar} className={botaoPrimario}>
          Convidar
        </button>
        <button onClick={copiar} className={botaoSecundario}>
          {copiado ? "Link copiado" : "Copiar link"}
        </button>
      </div>
    </section>
  );
}

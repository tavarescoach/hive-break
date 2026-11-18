"use client";

import { useState, useTransition } from "react";
import { DeclaracaoSaude } from "@/componentes/DeclaracaoSaude";
import { botaoPrimario, cartao } from "@/componentes/estilos";
import { PERGUNTAS_PRONTIDAO } from "@/dominio/declaracao-saude";

/** Abre os dois pop-ups da declaração de saúde e grava pela ação dada (cadastro ou perfil). */
export function TelaDeclaracao({
  acao, botao = "Responder",
}: {
  acao: (todasNao: boolean) => Promise<{ erro?: string; destino?: string }>;
  botao?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  const confirmar = (todasNao: boolean) => {
    setErro(null);
    iniciar(async () => {
      const r = await acao(todasNao);
      if (r.destino) {
        window.location.assign(r.destino);
        return;
      }
      setErro(r.erro ?? "Não consegui salvar. Tente de novo.");
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ol className={`${cartao} flex flex-col gap-2 text-[15px] leading-snug`}>
        {PERGUNTAS_PRONTIDAO.map((p, i) => (
          <li key={p}><span className="font-bold text-mel">{i + 1}.</span> {p}</li>
        ))}
      </ol>
      <button onClick={() => setAberto(true)} className={`${botaoPrimario} mt-auto`}>{botao}</button>
      <DeclaracaoSaude aberto={aberto} aoFechar={() => setAberto(false)} aoConfirmar={confirmar} ocupado={ocupado} erro={erro} />
    </div>
  );
}

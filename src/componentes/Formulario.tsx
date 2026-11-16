"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "@/app/onboarding/acoes";
import { BotaoEnviar } from "./BotaoEnviar";

type Acao = (anterior: EstadoFormulario, formulario: FormData) => Promise<EstadoFormulario>;

/**
 * Formulário ligado a uma ação do servidor: mostra o erro devolvido e o botão
 * principal no rodapé. `children` pode ser uma função para reagir ao estado.
 */
export function Formulario({
  acao,
  botao,
  children,
  className = "",
}: {
  acao: Acao;
  botao: string;
  children: React.ReactNode | ((estado: EstadoFormulario) => React.ReactNode);
  className?: string;
}) {
  const [estado, enviar] = useActionState(acao, {});
  return (
    <form action={enviar} className={`flex flex-1 flex-col ${className}`}>
      <div className="flex flex-1 flex-col gap-3">{typeof children === "function" ? children(estado) : children}</div>
      <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-fundo from-75% to-transparent px-5 pb-2 pt-6">
        {estado.erro && (
          <p role="alert" className="mb-3 rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">
            {estado.erro}
          </p>
        )}
        <BotaoEnviar>{botao}</BotaoEnviar>
      </div>
    </form>
  );
}

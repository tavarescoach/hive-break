"use client";

import { useFormStatus } from "react-dom";
import { botaoPrimario } from "./estilos";

/** Botão de formulário que mostra "Salvando…" enquanto a ação roda. */
export function BotaoEnviar({ children, className = botaoPrimario }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Salvando…" : children}
    </button>
  );
}

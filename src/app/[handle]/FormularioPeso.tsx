"use client";

import { useActionState, useState } from "react";
import { registrarPeso } from "./acoes";

/** Botão "Registrar peso" (docs/PERFIL.md, seção 2.3): no máximo 1 por dia. */
export function FormularioPeso({ compacto = false }: { compacto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [estado, enviar, pendente] = useActionState(registrarPeso, {});

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className={`shrink-0 rounded-xl border border-borda px-4 font-bold ${compacto ? "h-10 text-sm" : "h-12 text-base"}`}
      >
        Registrar peso
      </button>
    );
  }

  return (
    <form action={enviar} className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <input
          name="peso_kg"
          inputMode="decimal"
          placeholder="kg"
          autoFocus
          className="h-10 w-20 rounded-xl border border-borda bg-superficie px-3 text-sm font-semibold text-texto"
        />
        <button type="submit" disabled={pendente} className="h-10 shrink-0 rounded-xl bg-mel px-3 text-sm font-black text-black disabled:opacity-50">
          Salvar
        </button>
      </div>
      {estado.erro && <span role="alert" className="text-xs text-apagado">{estado.erro}</span>}
    </form>
  );
}

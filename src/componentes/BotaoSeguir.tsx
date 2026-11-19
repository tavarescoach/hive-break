"use client";

import { useState, useTransition } from "react";
import { deixarDeSeguirUsuario, seguirUsuario } from "@/app/(app)/amigos/buscar/acoes";
import { estadoSeguir, ROTULO_SEGUIR, type EstadoSeguir } from "@/dominio/busca";
import { botaoPrimario, botaoSecundario } from "./estilos";

/** Seguir / Seguindo / Seguir de volta, com atualização otimista (docs/PERFIL.md, seção 4). */
export function BotaoSeguir({
  alvoId,
  inicial,
  compacto = false,
}: {
  alvoId: string;
  inicial: { seguindo: boolean; segue_voce: boolean };
  compacto?: boolean;
}) {
  const [estado, setEstado] = useState<EstadoSeguir>(estadoSeguir(inicial));
  const [pendente, iniciar] = useTransition();

  const alternar = () => {
    const seguindoAgora = estado === "seguindo";
    const anterior = estado;
    setEstado(seguindoAgora ? (inicial.segue_voce ? "seguir_de_volta" : "seguir") : "seguindo");
    iniciar(async () => {
      const r = seguindoAgora ? await deixarDeSeguirUsuario(alvoId) : await seguirUsuario(alvoId);
      if (!r.ok) setEstado(anterior);
    });
  };

  if (compacto) {
    return (
      <button
        onClick={alternar}
        disabled={pendente}
        className={`h-9 shrink-0 rounded-full border px-4 text-sm font-bold disabled:opacity-50 ${
          estado === "seguindo" ? "border-borda text-apagado" : "border-mel text-mel"
        }`}
      >
        {ROTULO_SEGUIR[estado]}
      </button>
    );
  }

  return (
    <button onClick={alternar} disabled={pendente} className={estado === "seguindo" ? botaoSecundario : botaoPrimario}>
      {ROTULO_SEGUIR[estado]}
    </button>
  );
}

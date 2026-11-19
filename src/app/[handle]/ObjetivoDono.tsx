"use client";

import { useState } from "react";
import { calcularBarraPeso } from "@/dominio/peso";
import { FormularioPeso } from "./FormularioPeso";
import type { PesoCard } from "./ObjetivoCard";

const CHAVE_SESSAO = "hb_ocultar_peso";

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** "+4" ou "-4", para a meta ("meta 84 kg (+4 kg)"). */
const deltaMeta = (meta: number, inicial: number) => {
  const d = Math.round((meta - inicial) * 10) / 10;
  return d > 0 ? `+${d.toLocaleString("pt-BR")}` : d.toLocaleString("pt-BR");
};

/**
 * Título do objetivo + peso do dono, com o botão 👁 que esconde o peso só
 * nesta tela (docs/PERFIL.md, seção 2.3). Fica num componente só porque o
 * botão e o corpo compartilham esse estado.
 */
export function ObjetivoDono({ titulo, pesoCard }: { titulo: string; pesoCard: PesoCard | null }) {
  const [oculto, setOculto] = useState(() => {
    try {
      return sessionStorage.getItem(CHAVE_SESSAO) === "1";
    } catch {
      // Sem sessionStorage (ex.: navegação privada) ou durante o SSR: o botão ainda funciona, só não lembra.
      return false;
    }
  });

  const alternar = () => {
    setOculto((atual) => {
      const novo = !atual;
      try {
        sessionStorage.setItem(CHAVE_SESSAO, novo ? "1" : "0");
      } catch {
        // idem
      }
      return novo;
    });
  };

  const temPeso = pesoCard?.atual != null;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black uppercase tracking-tight">🎯 {titulo}</h2>
        {temPeso && (
          <button
            onClick={alternar}
            aria-pressed={oculto}
            aria-label={oculto ? "Mostrar peso nesta tela" : "Esconder peso nesta tela"}
            className="shrink-0 rounded-full p-1.5 text-lg text-apagado"
          >
            {oculto ? "🙈" : "👁"}
          </button>
        )}
      </div>

      {oculto ? (
        <p className="text-sm text-apagado">Peso escondido nesta tela.</p>
      ) : !pesoCard || pesoCard.atual == null ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-apagado">Você ainda não registrou nenhum peso.</p>
          <FormularioPeso />
        </div>
      ) : (
        <CorpoComPeso pesoCard={pesoCard} />
      )}
    </>
  );
}

function CorpoComPeso({ pesoCard }: { pesoCard: PesoCard }) {
  const { atual, meta, inicial, desde } = pesoCard;
  const barra = atual != null && inicial != null && desde ? calcularBarraPeso({ inicial, atual, meta: meta ?? null, desde: dataCurta(desde) }) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-2xl font-black tabular-nums">
          {atual!.toLocaleString("pt-BR")} kg
          {meta != null && inicial != null && (
            <span className="ml-2 text-base font-semibold text-apagado">
              → meta {meta.toLocaleString("pt-BR")} kg ({deltaMeta(meta, inicial)} kg)
            </span>
          )}
        </p>
        <FormularioPeso compacto />
      </div>
      {barra && (
        <div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-superficie-2">
            <div
              className={`h-full rounded-full transition-all ${barra.naDirecaoDaMeta ? "bg-mel" : "bg-apagado/60"}`}
              style={{ width: `${Math.max(4, barra.pct)}%` }}
            />
          </div>
          <p className="mt-1.5 text-sm text-apagado">{barra.rotulo}</p>
        </div>
      )}
    </div>
  );
}

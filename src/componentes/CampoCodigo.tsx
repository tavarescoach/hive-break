"use client";

import { useRef } from "react";
import { DIGITOS_CODIGO, soDigitos } from "@/dominio/codigo-email";

/**
 * Código de 6 dígitos em 6 caixas (docs/VISITANTE.md, seção 6): teclado
 * numérico, colar em qualquer caixa preenche todas e o preenchimento
 * automático do celular (autocomplete="one-time-code") também.
 */
export function CampoCodigo({
  valor, aoMudar, aoCompletar, desativado, erro,
}: {
  valor: string;
  aoMudar: (codigo: string) => void;
  aoCompletar: (codigo: string) => void;
  desativado?: boolean;
  erro?: boolean;
}) {
  const caixas = useRef<(HTMLInputElement | null)[]>([]);
  const focar = (i: number) => caixas.current[Math.max(0, Math.min(DIGITOS_CODIGO - 1, i))]?.focus();

  const preencher = (inicio: number, texto: string) => {
    const digitos = soDigitos(texto);
    if (!digitos) return;
    // Colou ou o celular preencheu o código inteiro: vale desde a 1ª caixa.
    const base = digitos.length >= DIGITOS_CODIGO ? "" : valor.slice(0, inicio);
    const novo = (base + digitos).slice(0, DIGITOS_CODIGO);
    aoMudar(novo);
    focar(novo.length);
    if (novo.length === DIGITOS_CODIGO) aoCompletar(novo);
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Código de 6 dígitos">
      {Array.from({ length: DIGITOS_CODIGO }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            caixas.current[i] = el;
          }}
          value={valor[i] ?? ""}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? DIGITOS_CODIGO : 1}
          disabled={desativado}
          aria-label={`Dígito ${i + 1} de ${DIGITOS_CODIGO}`}
          aria-invalid={erro || undefined}
          autoFocus={i === 0}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const texto = e.currentTarget.value;
            if (texto === "") {
              aoMudar(valor.slice(0, i) + valor.slice(i + 1));
              return;
            }
            preencher(i, texto);
          }}
          onPaste={(e) => {
            e.preventDefault();
            preencher(i, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !valor[i] && i > 0) {
              e.preventDefault();
              aoMudar(valor.slice(0, i - 1));
              focar(i - 1);
            } else if (e.key === "ArrowLeft") focar(i - 1);
            else if (e.key === "ArrowRight") focar(i + 1);
          }}
          className={`h-16 w-full min-w-0 rounded-xl border bg-superficie text-center text-3xl font-black tabular-nums text-texto focus:border-mel focus:outline-none disabled:opacity-50 ${erro ? "border-ruim" : "border-borda"}`}
        />
      ))}
    </div>
  );
}

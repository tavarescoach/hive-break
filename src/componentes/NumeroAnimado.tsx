"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que sobe de 0 até o valor uma vez, quando o card abre (docs/PERFIL.md,
 * seção 2.5). Respeita "menos movimento" e não anima de novo se o valor não mudar.
 */
export function NumeroAnimado({ valor, duracaoMs = 600 }: { valor: number; duracaoMs?: number }) {
  const [mostrado, setMostrado] = useState(0);
  const ultimoValor = useRef<number | null>(null);

  useEffect(() => {
    if (ultimoValor.current === valor) return;
    ultimoValor.current = valor;

    const semMovimento = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const inicio = performance.now();
    let quadro: number;
    const passo = (agora: number) => {
      const t = semMovimento ? 1 : Math.min(1, (agora - inicio) / duracaoMs);
      setMostrado(Math.round(valor * (1 - Math.pow(1 - t, 3))));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracaoMs]);

  return <span className="tabular-nums">{mostrado.toLocaleString("pt-BR")}</span>;
}

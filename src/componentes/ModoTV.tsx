"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { aplicarModoTV } from "@/lib/modo-tv";

/**
 * Mantém o modo TV aplicado: relê `?girar` a cada troca de tela e reaplica a marca no <html>
 * quando o celular gira (resize/orientationchange, com um pequeno debounce).
 * A rotação em si é CSS; aqui só garantimos que a marca nunca se perde.
 */
export function ModoTV() {
  const caminho = usePathname();

  useEffect(() => {
    aplicarModoTV();
  }, [caminho]);

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | undefined;
    const reaplicar = () => {
      clearTimeout(espera);
      espera = setTimeout(aplicarModoTV, 120);
    };
    window.addEventListener("resize", reaplicar);
    window.addEventListener("orientationchange", reaplicar);
    window.addEventListener("pageshow", aplicarModoTV);
    return () => {
      clearTimeout(espera);
      window.removeEventListener("resize", reaplicar);
      window.removeEventListener("orientationchange", reaplicar);
      window.removeEventListener("pageshow", aplicarModoTV);
    };
  }, []);

  return null;
}

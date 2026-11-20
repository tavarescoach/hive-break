"use client";

import { useEffect } from "react";
import { marcarFtueAberto, registrarEvento } from "@/lib/eventos";

/** Marca a abertura do primeiro acesso (Etapa 1A): não renderiza nada. */
export function RegistrarFtue() {
  useEffect(() => {
    marcarFtueAberto();
    registrarEvento("ftue_aberto");
  }, []);
  return null;
}

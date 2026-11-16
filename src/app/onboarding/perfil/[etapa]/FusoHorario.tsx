"use client";

import { useSyncExternalStore } from "react";

const assinar = () => () => {};
const noNavegador = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Envia junto o fuso horário do aparelho (virada do dia da ofensiva e avisos). */
export function FusoHorario() {
  const fuso = useSyncExternalStore(assinar, noNavegador, () => "");
  return <input type="hidden" name="fuso" value={fuso} />;
}

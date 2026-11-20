"use client";

import Link from "next/link";
import { registrarEvento } from "@/lib/eventos";

/** O "Começar" da landing, com o evento comecar_tocado (Etapa 1A). */
export function BotaoComecar({ className }: { className: string }) {
  return (
    <Link href="/comecar" className={className} onClick={() => registrarEvento("comecar_tocado")}>
      Começar
    </Link>
  );
}

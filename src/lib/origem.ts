import "server-only";

import { headers } from "next/headers";

/** Origem absoluta da requisição (para QR code e links que precisam do domínio inteiro). */
export async function origemAbsoluta(): Promise<string> {
  const lista = await headers();
  const proto = lista.get("x-forwarded-proto") ?? "https";
  const host = lista.get("host") ?? "hivebreak.app";
  return `${proto}://${host}`;
}

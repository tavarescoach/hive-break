import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Compara o header x-lembretes-segredo com LEMBRETES_SEGREDO em tempo constante. */
export function segredoConfere(recebido: string | null): boolean {
  const segredo = process.env.LEMBRETES_SEGREDO ?? "";
  if (!segredo || !recebido) return false;
  const a = Buffer.from(segredo);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mesma assinatura de public.lembrete_assinatura_abertura(): hmac-sha256('aberto.<id>'). */
export function assinaturaAbertura(logId: number): string {
  return createHmac("sha256", process.env.LEMBRETES_SEGREDO ?? "").update(`aberto.${logId}`).digest("hex");
}

import { NextResponse, type NextRequest } from "next/server";
import { criarClienteAnonimo } from "@/lib/supabase/anonimo";

export const dynamic = "force-dynamic";

/** O service worker avisa que a pessoa tocou na notificação (aberto_em). */
export async function POST(request: NextRequest) {
  const corpo = (await request.json().catch(() => null)) as { log_id?: unknown; assinatura?: unknown } | null;
  const logId = Number(corpo?.log_id);
  if (!Number.isSafeInteger(logId) || logId <= 0 || typeof corpo?.assinatura !== "string") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { data } = await criarClienteAnonimo().rpc("registrar_abertura_lembrete", {
    p_log_id: logId,
    p_assinatura: corpo.assinatura.slice(0, 128),
  });
  return NextResponse.json({ ok: data === true });
}

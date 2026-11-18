import { NextResponse, type NextRequest } from "next/server";
import webpush, { WebPushError } from "web-push";
import { assinaturaAbertura, segredoConfere } from "@/lib/lembretes-segredo";
import { criarClienteAnonimo } from "@/lib/supabase/anonimo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DadosPush {
  log_id: number;
  gatilho: string;
  titulo: string | null;
  texto: string | null;
  url: string | null;
  inscricoes: { endpoint: string; chaves: { p256dh: string; auth: string } }[];
}

/**
 * Chamada pelo n8n para cada linha de canal 'push': lê o texto reservado em
 * notification_log e envia para todos os aparelhos ativos da pessoa.
 * 200 se ao menos um aparelho recebeu; senão erro (o n8n marca 'falhou').
 */
export async function POST(request: NextRequest) {
  if (!segredoConfere(request.headers.get("x-lembretes-segredo"))) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }
  const corpo = (await request.json().catch(() => null)) as { log_id?: unknown } | null;
  const logId = Number(corpo?.log_id);
  if (!Number.isSafeInteger(logId) || logId <= 0) {
    return NextResponse.json({ erro: "log_id_invalido" }, { status: 400 });
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return NextResponse.json({ erro: "vapid_nao_configurado" }, { status: 500 });
  }

  const supabase = criarClienteAnonimo();
  const segredo = process.env.LEMBRETES_SEGREDO!;
  const { data, error } = await supabase.rpc("lembrete_push_dados", { p_segredo: segredo, p_log_id: logId });
  if (error) return NextResponse.json({ erro: "banco", detalhe: error.message }, { status: 500 });
  const dados = data as DadosPush | null;
  if (!dados) return NextResponse.json({ erro: "log_nao_encontrado" }, { status: 404 });
  if (dados.inscricoes.length === 0) return NextResponse.json({ erro: "sem_aparelho" }, { status: 410 });

  const carga = JSON.stringify({
    titulo: dados.titulo ?? "Hive Break",
    texto: dados.texto ?? "",
    url: dados.url ?? "/trilha",
    gatilho: dados.gatilho,
    log_id: dados.log_id,
    assinatura: assinaturaAbertura(dados.log_id),
  });
  const opcoes = {
    vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY },
    // Lembrete velho não serve: se o aparelho estiver desligado por mais de 4 h, descarta.
    TTL: 4 * 60 * 60,
    timeout: 8000,
  };

  const resultados = await Promise.allSettled(
    dados.inscricoes.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.chaves }, carga, opcoes)),
  );
  const expirados: string[] = [];
  const erros: string[] = [];
  let enviados = 0;
  resultados.forEach((r, i) => {
    if (r.status === "fulfilled") {
      enviados += 1;
      return;
    }
    const erro = r.reason as WebPushError | Error;
    const status = erro instanceof WebPushError ? erro.statusCode : undefined;
    if (status === 404 || status === 410) expirados.push(dados.inscricoes[i].endpoint);
    erros.push(status ? `HTTP ${status}` : erro.message);
  });
  if (expirados.length) {
    await supabase.rpc("lembrete_push_desativar", { p_segredo: segredo, p_endpoints: expirados });
  }

  if (enviados > 0) return NextResponse.json({ ok: true, enviados, expirados: expirados.length });
  return NextResponse.json({ erro: "nenhum_aparelho_recebeu", detalhe: erros.join("; ") }, { status: 502 });
}

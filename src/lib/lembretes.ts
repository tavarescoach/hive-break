import "server-only";

import { after } from "next/server";

/**
 * Gatilhos imediatos dos lembretes (FUNIL_LEMBRETES.md): depois de uma ação, o
 * app avisa o n8n, que chama lembrete_imediato() no banco e envia na hora.
 *
 * Roda depois da resposta (after), com timeout curto, e nunca quebra o fluxo:
 * sem N8N_WEBHOOK_URL/LEMBRETES_SEGREDO, ou com o n8n fora do ar, nada acontece.
 */
export interface EventoLembrete {
  user_id: string;
  gatilho: string;
  dados?: Record<string, unknown>;
}

const TIMEOUT_MS = 2500;

function ehEvento(valor: unknown): valor is EventoLembrete {
  const e = valor as EventoLembrete;
  return typeof e?.user_id === "string" && typeof e?.gatilho === "string";
}

export async function enviarAoN8n(eventos: unknown): Promise<number> {
  const url = process.env.N8N_WEBHOOK_URL;
  const segredo = process.env.LEMBRETES_SEGREDO;
  if (!url || !segredo || !Array.isArray(eventos)) return 0;
  const validos = eventos.filter(ehEvento);
  const resultados = await Promise.allSettled(
    validos.map((e) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-lembretes-segredo": segredo },
        body: JSON.stringify({ user_id: e.user_id, gatilho: e.gatilho, dados: e.dados ?? {} }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    ),
  );
  return resultados.filter((r) => r.status === "fulfilled" && r.value.ok).length;
}

/** Agenda o envio para depois da resposta. `obter` pode consultar o banco. */
export function dispararLembretes(obter: () => Promise<unknown> | unknown): void {
  try {
    after(async () => {
      try {
        await enviarAoN8n(await obter());
      } catch {
        // Lembrete é bônus: falha aqui nunca chega à pessoa.
      }
    });
  } catch {
    // Fora de uma requisição (ex.: testes): ignora.
  }
}

"use server";

import type { Familia } from "@/conteudo/ganchos";
import { lerSessao } from "@/lib/sessao";

/**
 * Convite enviado a partir do card pós-treino, com a família e o id do gancho
 * escolhido (seção 4 do GANCHOS_CONVITE.md). Quando a pessoa desligou a frase
 * ("Não usar"), familia/ganchoId ainda chegam aqui: é o que seria mostrado,
 * útil para medir a conversão do teste A/B independente do toggle.
 */
export async function registrarConviteComGancho(familia: Familia, ganchoId: string): Promise<void> {
  const sessao = await lerSessao();
  // Visitante não convida com recompensa (VISITANTE.md, seção 3): o card leva só o link do site.
  if (!sessao || sessao.perfil.visitante || !sessao.perfil.onboarding_concluido_em) return;
  await sessao.supabase.rpc("registrar_convite_enviado", { p_familia: familia, p_gancho_id: ganchoId });
}

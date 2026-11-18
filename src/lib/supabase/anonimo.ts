import "server-only";

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "./env";

/**
 * Cliente sem sessão (papel anon), para rotas chamadas sem login: o n8n e o
 * service worker. Só alcança funções liberadas para anon, que conferem o
 * segredo ou a assinatura no próprio banco.
 */
export function criarClienteAnonimo() {
  return createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

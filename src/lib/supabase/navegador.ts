"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "./env";

/** Cliente Supabase para componentes do navegador (login). */
export function criarClienteNavegador() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA);
}

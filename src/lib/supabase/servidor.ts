import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from "./env";

/**
 * Cliente Supabase para o servidor (páginas, ações e rotas). Usa a chave
 * pública e a sessão do usuário nos cookies, então toda consulta passa pela RLS.
 */
export async function criarClienteServidor() {
  const jarra = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    cookies: {
      getAll: () => jarra.getAll(),
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => jarra.set(name, value, options));
        } catch {
          // Em páginas (Server Components) os cookies são só de leitura; a
          // renovação da sessão acontece no proxy.
        }
      },
    },
  });
}

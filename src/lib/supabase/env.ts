/** Endereço e chave pública do projeto Supabase (ver docs/CONFIGURACAO.md). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_CHAVE_PUBLICA =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sem as variáveis de ambiente o app mostra um aviso em vez de quebrar. */
export const supabaseConfigurado = SUPABASE_URL !== "" && SUPABASE_CHAVE_PUBLICA !== "";

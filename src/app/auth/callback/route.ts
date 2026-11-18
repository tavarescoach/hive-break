import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_CONVITE, COOKIE_GANCHO, normalizarCodigo, normalizarGanchoCookie } from "@/lib/convite";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * Volta do login com Google: troca o código pela sessão e, se a pessoa chegou
 * por um link de convite, registra quem convidou (validado no servidor pela
 * função registrar_convite) e, se o link tinha um gancho, o evento "cadastro"
 * do funil da seção 4 (GANCHOS_CONVITE.md). Depois segue para o primeiro acesso.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");
  if (!codigo) return NextResponse.redirect(new URL("/entrar?erro=login", url.origin));

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);
  if (error) return NextResponse.redirect(new URL("/entrar?erro=login", url.origin));

  const jarra = await cookies();
  const convite = normalizarCodigo(jarra.get(COOKIE_CONVITE)?.value ?? "");
  const gancho = normalizarGanchoCookie(jarra.get(COOKIE_GANCHO)?.value);
  if (convite) {
    await supabase.rpc("registrar_convite", { p_codigo: convite });
    jarra.delete(COOKIE_CONVITE);
  }
  if (gancho) {
    await supabase.rpc("registrar_cadastro_convite", { p_familia: gancho.familia, p_gancho_id: gancho.ganchoId });
    jarra.delete(COOKIE_GANCHO);
  }
  return NextResponse.redirect(new URL("/onboarding", url.origin));
}

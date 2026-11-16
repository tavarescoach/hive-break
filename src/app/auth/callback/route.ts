import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_CONVITE, normalizarCodigo } from "@/lib/convite";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * Volta do login com Google: troca o código pela sessão e, se a pessoa chegou
 * por um link de convite, registra quem convidou (validado no servidor pela
 * função registrar_convite). Depois segue para o primeiro acesso.
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
  if (convite) {
    await supabase.rpc("registrar_convite", { p_codigo: convite });
    jarra.delete(COOKIE_CONVITE);
  }
  return NextResponse.redirect(new URL("/onboarding", url.origin));
}

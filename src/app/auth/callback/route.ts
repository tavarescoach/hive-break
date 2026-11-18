import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_CONVITE, COOKIE_GANCHO, COOKIE_MIGRACAO, normalizarCodigo, normalizarGanchoCookie } from "@/lib/convite";
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
  const jarra = await cookies();
  const migracao = jarra.get(COOKIE_MIGRACAO)?.value;
  // Visitante vinculando o Google: essa conta Google já existe. Oferece entrar nela e levar o resultado.
  if (!codigo && migracao && /identity_already_exists|already/i.test(`${url.searchParams.get("error_code")} ${url.searchParams.get("error_description")}`)) {
    return NextResponse.redirect(new URL("/salvar?google=existe", url.origin));
  }
  if (!codigo) return NextResponse.redirect(new URL(migracao ? "/salvar?erro=google" : "/entrar?erro=login", url.origin));

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);
  if (error) return NextResponse.redirect(new URL(migracao ? "/salvar?erro=google" : "/entrar?erro=login", url.origin));

  // Visitante (docs/VISITANTE.md): se entrou numa conta Google que já existia,
  // leva o resultado para ela; se vinculou o Google ao próprio visitante, só confirma.
  if (migracao) {
    await supabase.rpc("migrar_visitante_por_token", { p_token: migracao });
    jarra.delete(COOKIE_MIGRACAO);
  }
  await supabase.rpc("confirmar_visitante").then(() => {}, () => {});

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

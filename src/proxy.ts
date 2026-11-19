import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL, supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Renova a sessão do Supabase a cada navegação e grava os cookies novos.
 * A decisão de quem pode ver cada página fica nas próprias páginas
 * (src/lib/sessao.ts), não aqui.
 */
export async function proxy(request: NextRequest) {
  return lembrarModoTV(request, await renovarSessao(request));
}

/**
 * Modo TV (src/lib/modo-tv.ts): guarda `?girar` num cookie já no servidor. Várias páginas
 * redirecionam (por exemplo, "/" logado vai para "/trilha") e o redirecionamento perde o
 * parâmetro antes de o script da página rodar; o cookie chega à página seguinte.
 */
function lembrarModoTV(request: NextRequest, resposta: NextResponse): NextResponse {
  const giro = request.nextUrl.searchParams.get("girar");
  if (giro === "0" || giro === "90" || giro === "270") {
    resposta.cookies.set("modoTV", giro, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return resposta;
}

async function renovarSessao(request: NextRequest): Promise<NextResponse> {
  if (!supabaseConfigurado) return NextResponse.next({ request });

  let resposta = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(lista, cabecalhos) {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        Object.entries(cabecalhos ?? {}).forEach(([chave, valor]) => resposta.headers.set(chave, valor));
      },
    },
  });
  await supabase.auth.getUser();
  return resposta;
}

export const config = {
  // Tudo, menos arquivos estáticos, o MediaPipe e o teste técnico (que não usa login).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|mediapipe/|teste-tecnico|.*\\.(?:svg|png|jpg|jpeg|webp|ico|json|txt|webmanifest)$).*)"],
};

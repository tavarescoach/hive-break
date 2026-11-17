import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL, supabaseConfigurado } from "@/lib/supabase/env";

/**
 * Renova a sessão do Supabase a cada navegação e grava os cookies novos.
 * A decisão de quem pode ver cada página fica nas próprias páginas
 * (src/lib/sessao.ts), não aqui.
 */
export async function proxy(request: NextRequest) {
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

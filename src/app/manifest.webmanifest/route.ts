import { manifestoBase } from "@/lib/manifesto";

/**
 * Manifesto do app (/manifest.webmanifest): faz o Android/Chrome oferecer "Instalar app".
 * É uma rota (e não src/app/manifest.ts) para o Next não pôr o <link rel="manifest"> fixo no
 * HTML: quem cria o link é o script do modo TV, já com o manifesto certo (src/lib/modo-tv.ts).
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(manifestoBase(), { headers: { "Content-Type": "application/manifest+json" } });
}

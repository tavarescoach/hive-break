import { manifestoBase } from "@/lib/manifesto";

/**
 * Manifesto do modo TV (/manifest-tv.webmanifest?girar=270).
 *
 * O app salvo na tela de início do iPhone tem armazenamento separado do Safari e abre pelo
 * start_url, então não herdaria o modo TV. Aqui o start_url já leva o ?girar e a orientação
 * fica livre, para o app poder ficar na horizontal. O <link rel="manifest"> da página aponta
 * para cá enquanto o modo TV está ligado (ver aplicarModoTV em src/lib/modo-tv.ts).
 */
export function GET(request: Request) {
  const giro = new URL(request.url).searchParams.get("girar") === "90" ? "90" : "270";
  const manifesto = {
    ...manifestoBase(),
    id: `/?girar=${giro}`,
    name: "Hive Break TV",
    start_url: `/?girar=${giro}`,
    orientation: "any",
  };
  return Response.json(manifesto, { headers: { "Content-Type": "application/manifest+json" } });
}

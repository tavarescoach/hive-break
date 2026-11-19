import type { MetadataRoute } from "next";
import { manifestoBase } from "@/lib/manifesto";

/**
 * Manifesto do app (servido em /manifest.webmanifest).
 * É o que faz o Android/Chrome oferecer "Instalar app" e usar o hexágono como ícone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return manifestoBase();
}

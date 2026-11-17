import type { MetadataRoute } from "next";

/**
 * Manifesto do app (servido em /manifest.webmanifest).
 * É o que faz o Android/Chrome oferecer "Instalar app" e usar o hexágono como ícone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hive Break",
    short_name: "Hive Break",
    description: "Um desafio de 5 minutos por dia, com um treinador na câmera que conta, corrige e pontua cada repetição.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0e11",
    theme_color: "#0d0e11",
    icons: [
      { src: "/icones/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

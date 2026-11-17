import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/**
 * Regra inegociável: nenhuma imagem ou vídeo sai do aparelho.
 * `connect-src 'self'` faz o próprio navegador recusar qualquer envio de dados
 * para fora do nosso domínio. Isso também bloqueia a telemetria de uso que a
 * biblioteca do MediaPipe tenta mandar para odml.pa.googleapis.com.
 * A única exceção é o projeto Supabase (login e dados numéricos).
 */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
// O tempo real da hive (Supabase Realtime) usa WebSocket no mesmo projeto: só números.
const supabaseWs = supabase.replace(/^http/, "ws");
const csp = ["connect-src 'self'", supabase, supabaseWs, dev ? "ws: wss:" : ""].filter(Boolean).join(" ");

const config: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:caminho*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        // WASM e modelos de pose mudam só quando a versão do pacote muda.
        source: "/mediapipe/:caminho*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }],
      },
    ];
  },
};

export default config;

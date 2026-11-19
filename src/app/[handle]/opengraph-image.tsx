import { ImageResponse } from "next/og";
import { CORES_DIVISAO, NOMES_DIVISAO, type Divisao } from "@/dominio/liga";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Prévia do link (docs/PERFIL.md, seção 5): nome, ofensiva e divisão. Nunca o peso. */
export default async function Imagem({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const username = handle.replace(/^@/, "");
  const supabase = await criarClienteServidor();

  const { data: perfil } = await supabase.from("perfis_publicos").select("id, apelido, username").eq("username", username).maybeSingle();
  const { data: estatisticas } = perfil
    ? await supabase.rpc("estatisticas_perfil", { p_user: perfil.id })
    : { data: null };

  const nome = perfil?.apelido ?? username;
  const ofensiva = (estatisticas as { ofensiva?: number } | null)?.ofensiva ?? 0;
  const divisao = ((estatisticas as { divisao?: string } | null)?.divisao ?? "bronze") as Divisao;
  const cor = CORES_DIVISAO[divisao] ?? CORES_DIVISAO.bronze;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          backgroundColor: "#0d0e11", color: "#f5f2ea", padding: 80, fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex", width: 48, height: 48, backgroundColor: cor,
              clipPath: "polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0% 50%)",
            }}
          />
          <span style={{ fontSize: 32, fontWeight: 900, color: "#ffc42e" }}>HIVE BREAK</span>
        </div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 72, fontWeight: 900 }}>{nome}</div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 36, color: "#a3a6ae" }}>@{username}</div>
        <div style={{ marginTop: 40, display: "flex", gap: 32, fontSize: 32 }}>
          <span>🔥 {ofensiva} dias</span>
          <span style={{ color: cor }}>{NOMES_DIVISAO[divisao] ?? NOMES_DIVISAO.bronze}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

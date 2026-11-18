import { ImageResponse } from "next/og";
import { familiaDaQuery, normalizarCodigo } from "@/lib/convite";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export const alt = "Convite para o Hive Break";

interface Convite {
  apelido: string;
  ofensiva: number;
}

/**
 * Prévia do link no WhatsApp (seção 3.2). Nunca a foto do card de quem
 * convidou — isso nunca saiu do aparelho dela. Só o nome e a ofensiva, que já
 * são públicos na landing /c/[codigo].
 */
export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = normalizarCodigo((await params).codigo);
  const familia = familiaDaQuery(new URL(request.url).searchParams.get("g")) ?? "C";

  let convite: Convite | null = null;
  if (codigo && supabaseConfigurado) {
    const supabase = await criarClienteServidor();
    const { data } = await supabase.rpc("convite_publico", { p_codigo: codigo }).maybeSingle();
    convite = (data as Convite | null) ?? null;
  }
  const apelido = convite?.apelido ?? "Alguém";
  const ofensiva = convite?.ofensiva ?? 0;

  const chamada =
    familia === "D"
      ? "te desafiou"
      : familia === "B"
        ? "te chamou para um break de 3 min"
        : "quer fazer um break com você";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 64, backgroundColor: "#0d0e11", color: "#f5f2ea", fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: "#a3a6ae" }}>Hive Break</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1.15 }}>{`${apelido} ${chamada}`}</div>
          {ofensiva > 0 && (
            <div style={{ fontSize: 32, fontWeight: 700, color: "#ffc42e" }}>
              {`${ofensiva} ${ofensiva === 1 ? "dia" : "dias"} seguidos`}
            </div>
          )}
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#a3a6ae" }}>
          3 minutos, direto no navegador — sem academia e sem equipamento
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

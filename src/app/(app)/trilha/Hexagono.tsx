/** Hexágono da colmeia: face, "espessura" embaixo e um ícone no centro. */
export type Visual = "concluido" | "atual" | "disponivel" | "bloqueado";
export type Icone = "check" | "play" | "cadeado" | "bau" | "bau_aberto" | "trofeu";

const CORES: Record<Visual, { face: string; borda: string; icone: string }> = {
  // Mel escuro: já feito.
  concluido: { face: "#C78A0A", borda: "#8A5E00", icone: "#2A1B00" },
  atual: { face: "#FFC42E", borda: "#C28E00", icone: "#1A1200" },
  disponivel: { face: "#FFC42E", borda: "#C28E00", icone: "#1A1200" },
  bloqueado: { face: "#3A3E48", borda: "#262930", icone: "#8A8E98" },
};

const FACE = "50,10 84,29.5 84,68.5 50,88 16,68.5 16,29.5";
const FUNDO = "50,19 84,38.5 84,77.5 50,97 16,77.5 16,38.5";

function Desenho({ icone, cor }: { icone: Icone; cor: string }) {
  const traco = { fill: "none", stroke: cor, strokeWidth: 7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icone) {
    case "check":
      return <path d="M36 50l10 10 19-22" {...traco} strokeWidth={8} />;
    case "play":
      return <path d="M43 35v28l23-14z" fill={cor} stroke={cor} strokeWidth={5} strokeLinejoin="round" />;
    case "cadeado":
      return (
        <>
          <path d="M41 46v-6a9 9 0 0 1 18 0v6" {...traco} strokeWidth={6} />
          <rect x="35" y="46" width="30" height="21" rx="5" fill={cor} />
        </>
      );
    case "bau":
      return (
        <>
          <path d="M33 47a9 9 0 0 1 9-9h16a9 9 0 0 1 9 9v2H33z" fill={cor} />
          <rect x="33" y="52" width="34" height="15" rx="3" fill={cor} />
          <rect x="46.5" y="46" width="7" height="10" rx="2" fill={cor} stroke="#00000055" strokeWidth={1.5} />
        </>
      );
    case "bau_aberto":
      return (
        <>
          <path d="M35 44l6-10h18l6 10z" fill={cor} opacity={0.7} />
          <rect x="33" y="48" width="34" height="19" rx="3" fill={cor} />
          <path d="M43 57l5 5 9-10" fill="none" stroke="#C78A0A" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "trofeu":
      return (
        <>
          <path d="M40 34h20v10a10 10 0 0 1-20 0z" fill={cor} />
          <path d="M40 37h-6v3a7 7 0 0 0 7 7M60 37h6v3a7 7 0 0 1-7 7" {...traco} strokeWidth={4} />
          <path d="M50 54v7M42 65h16" {...traco} strokeWidth={5} />
        </>
      );
  }
}

export function Hexagono({ visual, icone, tamanho }: { visual: Visual; icone: Icone; tamanho: number }) {
  const cor = CORES[visual];
  return (
    <svg width={tamanho} height={tamanho * 1.07} viewBox="0 0 100 107" aria-hidden className="block overflow-visible">
      <polygon points={FUNDO} fill={cor.borda} stroke={cor.borda} strokeWidth={10} strokeLinejoin="round" />
      <polygon points={FACE} fill={cor.face} stroke={cor.face} strokeWidth={10} strokeLinejoin="round" />
      <polygon points="50,17 78,33 78,40 50,24 22,40 22,33" fill="#ffffff" opacity={visual === "bloqueado" ? 0.05 : 0.22} />
      <Desenho icone={icone} cor={cor.icone} />
    </svg>
  );
}

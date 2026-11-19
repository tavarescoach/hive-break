import type { IdTrilhaAcessoria } from "@/dominio/trilhaAcessoria";

/**
 * Ícone das trilhas acessórias: hexágono #242B47 com borda e sombra na cor de
 * acento da trilha, e dentro, o esqueleto do jogo (ossos #FFC42E, juntas
 * brancas, cabeça = bolinha do nariz um pouco maior) na pose da trilha.
 */

const CLIP = "100,6 184,54 184,150 100,198 16,150 16,54";
const SOMBRA = "100,16 184,64 184,160 100,208 16,160 16,64";

function Osso({ d }: { d: string }) {
  return <path d={d} stroke="#FFC42E" strokeWidth={7} strokeLinecap="round" />;
}

function Juntas({ pontos }: { pontos: [number, number, number?][] }) {
  return (
    <>
      {pontos.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r ?? 5.5} fill="#FFFFFF" />
      ))}
    </>
  );
}

/** Esqueleto na "Hive Office": sentado numa cadeira, de frente para a mesa. */
function EsqueletoOffice() {
  return (
    <>
      <ellipse cx="100" cy="180" rx="70" ry="11" fill="#1A2036" />
      <rect x="118" y="112" width="64" height="8" rx="3" fill="#3A4366" />
      <path d="M176 120V178" stroke="#3A4366" strokeWidth={5} strokeLinecap="round" />
      <rect x="128" y="88" width="34" height="22" rx="3" fill="#F5F2EA" />
      <rect x="132" y="92" width="26" height="14" rx="2" fill="#242B47" />
      <rect x="124" y="108" width="44" height="5" rx="2" fill="#F5F2EA" />
      <rect x="44" y="80" width="9" height="56" rx="4.5" fill="#3A4366" />
      <rect x="44" y="128" width="58" height="9" rx="4.5" fill="#3A4366" />
      <path d="M72 137V174M56 176H88" stroke="#3A4366" strokeWidth={5} strokeLinecap="round" />
      <Osso d="M62 84L90 84" />
      <Osso d="M62 84L66 124" />
      <Osso d="M90 84L86 124" />
      <Osso d="M66 124L86 124" />
      <Osso d="M62 84L52 60" />
      <Osso d="M52 60L48 36" />
      <Osso d="M90 84L100 60" />
      <Osso d="M100 60L104 36" />
      <Osso d="M66 124L104 126" />
      <Osso d="M104 126L104 166" />
      <Osso d="M86 124L110 130" />
      <Osso d="M110 130L110 168" />
      <Juntas
        pontos={[
          [76, 60, 7],
          [62, 84], [90, 84], [52, 60], [100, 60], [48, 36], [104, 36],
          [66, 124], [86, 124], [104, 126], [110, 130], [104, 166], [110, 168],
        ]}
      />
    </>
  );
}

/** Esqueleto na "Hive Coluna em Dia": alongamento de tronco, braços abertos. */
function EsqueletoColuna() {
  return (
    <>
      <ellipse cx="100" cy="180" rx="60" ry="11" fill="#1A2036" />
      <path d="M30 74l-8-3M30 86l-8 3M170 74l8-3M170 86l8 3" stroke="#5ED1B8" strokeWidth={3} strokeLinecap="round" />
      <Osso d="M84 74L116 74" />
      <Osso d="M84 74L90 122" />
      <Osso d="M116 74L110 122" />
      <Osso d="M90 122L110 122" />
      <Osso d="M84 74L64 78" />
      <Osso d="M64 78L46 80" />
      <Osso d="M116 74L136 78" />
      <Osso d="M136 78L154 80" />
      <Osso d="M90 122L88 148" />
      <Osso d="M88 148L87 174" />
      <Osso d="M110 122L112 148" />
      <Osso d="M112 148L113 174" />
      <path d="M46 80Q100 70 154 80" stroke="#5ED1B8" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Juntas
        pontos={[
          [100, 50, 7],
          [84, 74], [116, 74], [64, 78], [136, 78], [46, 80], [154, 80],
          [90, 122], [110, 122], [88, 148], [112, 148], [87, 174], [113, 174],
        ]}
      />
    </>
  );
}

/** Esqueleto na "Hive Heat": polichinelo, braços e pernas abertos, suando. */
function EsqueletoHeat() {
  return (
    <>
      <ellipse cx="100" cy="184" rx="40" ry="7" fill="#1A2036" />
      <path d="M40 150h14M36 160h12M146 150h14M152 160h12" stroke="#FF7A59" strokeWidth={3} strokeLinecap="round" />
      <path d="M152 98c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2.5 1 3.5 2 3.5 0-4-1-6 1-9.5z" fill="#FF7A59" />
      <path d="M124 40q4 6 0 9q-4-3 0-9z" fill="#FFB39F" />
      <path d="M76 40q4 6 0 9q-4-3 0-9z" fill="#FFB39F" />
      <Osso d="M86 70L114 70" />
      <Osso d="M86 70L92 116" />
      <Osso d="M114 70L108 116" />
      <Osso d="M92 116L108 116" />
      <Osso d="M86 70L70 52" />
      <Osso d="M70 52L62 28" />
      <Osso d="M114 70L130 52" />
      <Osso d="M130 52L138 28" />
      <Osso d="M92 116L80 144" />
      <Osso d="M80 144L68 170" />
      <Osso d="M108 116L120 144" />
      <Osso d="M120 144L132 170" />
      <Juntas
        pontos={[
          [100, 46, 7],
          [86, 70], [114, 70], [70, 52], [130, 52], [62, 28], [138, 28],
          [92, 116], [108, 116], [80, 144], [120, 144], [68, 170], [132, 170],
        ]}
      />
    </>
  );
}

/** Esqueleto na "Hive Desacelerar": alongamento calmo, estrelinhas de descanso. */
function EsqueletoDesacelerar() {
  return (
    <>
      <ellipse cx="100" cy="180" rx="64" ry="11" fill="#1A2036" />
      <circle cx="152" cy="42" r="16" fill="#9AA8FF" />
      <circle cx="160" cy="36" r="14" fill="#242B47" />
      <path d="M44 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#9AA8FF" />
      <path d="M134 74l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#9AA8FF" />
      <Osso d="M86 100L114 100" />
      <Osso d="M86 100L90 146" />
      <Osso d="M114 100L110 146" />
      <Osso d="M90 146L110 146" />
      <Osso d="M86 100L74 126" />
      <Osso d="M74 126L68 150" />
      <Osso d="M114 100L126 126" />
      <Osso d="M126 126L132 150" />
      <Osso d="M90 146L62 156" />
      <Osso d="M62 156L112 166" />
      <Osso d="M110 146L138 156" />
      <Osso d="M138 156L88 166" />
      <Juntas
        pontos={[
          [100, 76, 7],
          [86, 100], [114, 100], [74, 126], [126, 126], [68, 150], [132, 150],
          [90, 146], [110, 146], [62, 156], [138, 156], [112, 166], [88, 166],
        ]}
      />
    </>
  );
}

const ESQUELETOS: Record<IdTrilhaAcessoria, () => React.JSX.Element> = {
  office: EsqueletoOffice,
  coluna: EsqueletoColuna,
  heat: EsqueletoHeat,
  desacelerar: EsqueletoDesacelerar,
};

export function HexagonoAcessorio({
  trilha, cor, corSombra, tamanho, titulo,
}: {
  trilha: IdTrilhaAcessoria;
  cor: string;
  corSombra: string;
  tamanho: number;
  /** Texto do aria-label; omitido = decorativo (aria-hidden). */
  titulo?: string;
}) {
  const clipId = `cha-${trilha}-${tamanho}`;
  const Esqueleto = ESQUELETOS[trilha];
  return (
    <svg
      width={tamanho}
      height={tamanho * 1.06}
      viewBox="0 0 200 212"
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      className="block overflow-visible"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon points={CLIP} />
        </clipPath>
      </defs>
      <polygon points={SOMBRA} fill={corSombra} />
      <polygon points={CLIP} fill="#242B47" />
      <g clipPath={`url(#${clipId})`}>
        <g transform="translate(100 106) scale(0.86) translate(-100 -104)">
          <Esqueleto />
        </g>
      </g>
      <polygon points={CLIP} fill="none" stroke={cor} strokeWidth={8} strokeLinejoin="round" />
    </svg>
  );
}

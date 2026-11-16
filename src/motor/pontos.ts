/** Nomes em português para os 33 pontos do MediaPipe Pose Landmarker. */
export const INDICE_PONTO: Record<string, number> = {
  nariz: 0,
  olho_interno_e: 1,
  olho_e: 2,
  olho_externo_e: 3,
  olho_interno_d: 4,
  olho_d: 5,
  olho_externo_d: 6,
  orelha_e: 7,
  orelha_d: 8,
  boca_e: 9,
  boca_d: 10,
  ombro_e: 11,
  ombro_d: 12,
  cotovelo_e: 13,
  cotovelo_d: 14,
  punho_e: 15,
  punho_d: 16,
  mindinho_e: 17,
  mindinho_d: 18,
  indicador_e: 19,
  indicador_d: 20,
  polegar_e: 21,
  polegar_d: 22,
  quadril_e: 23,
  quadril_d: 24,
  joelho_e: 25,
  joelho_d: 26,
  tornozelo_e: 27,
  tornozelo_d: 28,
  calcanhar_e: 29,
  calcanhar_d: 30,
  ponta_pe_e: 31,
  ponta_pe_d: 32,
};

export const TOTAL_PONTOS = 33;

/** Plurais aceitos em `dist(joelhos)`: distância entre o lado esquerdo e o direito. */
export const PLURAIS: Record<string, string> = {
  ombros: "ombro",
  cotovelos: "cotovelo",
  punhos: "punho",
  quadris: "quadril",
  joelhos: "joelho",
  tornozelos: "tornozelo",
  calcanhares: "calcanhar",
  pontas_pes: "ponta_pe",
  olhos: "olho",
  orelhas: "orelha",
};

/** Ligações desenhadas no esqueleto (pares de índices). */
export const LIGACOES: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [27, 31],
  [28, 30],
  [30, 32],
  [28, 32],
];

/** Pontos do corpo desenhados como círculos (sem os detalhes do rosto e das mãos). */
export const PONTOS_DESENHADOS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export type RefPonto = { tipo: "unico"; indice: number } | { tipo: "par"; e: number; d: number };

/**
 * Resolve um nome de ponto. "joelho_e" é um ponto único; "joelho" é o par
 * esquerda/direita (vira ponto médio ou é calculado por lado, conforme a medida).
 */
export function resolverPonto(nome: string): RefPonto {
  if (nome in INDICE_PONTO) return { tipo: "unico", indice: INDICE_PONTO[nome] };
  const e = INDICE_PONTO[`${nome}_e`];
  const d = INDICE_PONTO[`${nome}_d`];
  if (e !== undefined && d !== undefined) return { tipo: "par", e, d };
  throw new Error(`Ponto desconhecido: "${nome}"`);
}

/** Índices envolvidos em um nome de ponto (um ou dois). */
export function indicesDoPonto(nome: string): number[] {
  const ref = resolverPonto(nome);
  return ref.tipo === "unico" ? [ref.indice] : [ref.e, ref.d];
}

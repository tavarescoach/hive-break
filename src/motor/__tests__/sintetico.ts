/**
 * Gerador de poses sintéticas para os testes do motor.
 *
 * Monta um boneco 3D (metros) a partir de poucos parâmetros (ângulo do joelho,
 * abertura dos pés, braços, pé elevado...) e o projeta como o MediaPipe faria:
 * pontos de imagem normalizados e pontos de mundo com origem no quadril.
 *
 * Eixos: X = esquerda da pessoa, Y = para baixo, Z negativo = em direção à câmera.
 */
import type { Fixture } from "../fixture";
import { serializarFrame } from "../fixture";
import { INDICE_PONTO, TOTAL_PONTOS } from "../pontos";
import type { Frame, Ponto } from "../tipos";

export interface ParametrosPose {
  /** Ângulo do joelho em graus (180 = perna reta). */
  joelho?: number;
  /** Metade da distância entre os tornozelos, em metros. */
  pes?: number;
  /** Quanto cada joelho entra para dentro, em metros (valgo). */
  valgo?: number;
  /** Abdução dos braços em graus: 0 = ao lado do corpo, 180 = acima da cabeça. */
  bracos?: number;
  /** Altura do pé esquerdo / direito fora do chão, em metros. */
  peE?: number;
  peD?: number;
  /** Elevação do joelho esquerdo / direito: 0 = em pé, 1 = coxa na horizontal (altura do quadril). */
  joelhoAltoE?: number;
  joelhoAltoD?: number;
  /** Deslocamento lateral do tronco e quadril, em metros (oscilação). */
  balanco?: number;
  /** Visibilidade de todos os pontos (padrão 0,95). */
  visibilidade?: number;
  /** Visibilidade só dos tornozelos e pés (simula pés cortados ou encobertos). */
  visibilidadePes?: number;
  /** Ninguém na imagem. */
  ausente?: boolean;
}

const CANELA = 0.42;
const TRONCO = 0.5;
const QUADRIL = 0.1;
const OMBRO = 0.18;
const BRACO = 0.28;
const ANTEBRACO = 0.26;
const ALTURA_TORNOZELO = 0.08;

/** Escala da projeção: fração da altura da imagem por metro. */
const ESCALA = 0.41;
const CHAO_Y = 0.92;
export const PROPORCAO = 0.75; // 480 x 640, retrato

type V3 = [number, number, number];

/** Gerador pseudoaleatório com semente (mulberry32), para fixtures reproduzíveis. */
export function criarAleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussiano(aleatorio: () => number): number {
  const u = Math.max(1e-12, aleatorio());
  const v = aleatorio();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const rad = (graus: number) => (graus * Math.PI) / 180;

/** Posições 3D dos 33 pontos para os parâmetros dados. */
function esqueleto(p: ParametrosPose): V3[] {
  const joelho = p.joelho ?? 175;
  const pes = p.pes ?? QUADRIL;
  const valgo = p.valgo ?? 0;
  const bracos = p.bracos ?? 5;
  const balanco = p.balanco ?? 0;

  const alfa = rad((180 - joelho) / 2);
  const comprimento = 2 * CANELA * Math.cos(alfa);
  const lateral = pes - QUADRIL;
  const alturaPerna = Math.sqrt(Math.max(0.01, comprimento ** 2 - lateral ** 2));
  const quadrilY = -ALTURA_TORNOZELO - alturaPerna;
  const ombroY = quadrilY - TRONCO;

  const pontos: V3[] = Array.from({ length: TOTAL_PONTOS }, () => [0, 0, 0] as V3);
  const definir = (nome: string, v: V3) => {
    pontos[INDICE_PONTO[nome]] = v;
  };

  for (const [sufixo, s, elevado] of [
    ["e", 1, p.peE ?? 0],
    ["d", -1, p.peD ?? 0],
  ] as const) {
    const tornozelo: V3 = [s * pes, -ALTURA_TORNOZELO - elevado, elevado > 0 ? 0.1 : 0];
    const quadril: V3 = [s * QUADRIL + balanco, quadrilY, 0];
    const joelhoPos: V3 = [
      (tornozelo[0] + quadril[0]) / 2 - s * valgo,
      (tornozelo[1] + quadril[1]) / 2,
      -CANELA * Math.sin(alfa) - (elevado > 0 ? 0.12 : 0),
    ];
    const subida = (sufixo === "e" ? p.joelhoAltoE : p.joelhoAltoD) ?? 0;
    if (subida > 0) {
      // Coxa gira para a frente a partir do quadril; a canela fica pendurada.
      const giro = rad(90 * subida);
      joelhoPos[0] = quadril[0];
      joelhoPos[1] = quadril[1] + CANELA * Math.cos(giro);
      joelhoPos[2] = -CANELA * Math.sin(giro);
      tornozelo[1] = joelhoPos[1] + CANELA;
      tornozelo[2] = joelhoPos[2];
    }
    definir(`quadril_${sufixo}`, quadril);
    definir(`joelho_${sufixo}`, joelhoPos);
    definir(`tornozelo_${sufixo}`, tornozelo);
    definir(`calcanhar_${sufixo}`, [tornozelo[0], tornozelo[1] + 0.06, tornozelo[2] + 0.04]);
    definir(`ponta_pe_${sufixo}`, [tornozelo[0], tornozelo[1] + 0.07, tornozelo[2] - 0.12]);

    const ombro: V3 = [s * OMBRO + balanco, ombroY, 0];
    const direcao: V3 = [s * Math.sin(rad(bracos)), Math.cos(rad(bracos)), 0];
    const cotovelo: V3 = [ombro[0] + BRACO * direcao[0], ombro[1] + BRACO * direcao[1], 0];
    const punho: V3 = [cotovelo[0] + ANTEBRACO * direcao[0], cotovelo[1] + ANTEBRACO * direcao[1], 0];
    const mao: V3 = [punho[0] + 0.08 * direcao[0], punho[1] + 0.08 * direcao[1], 0];
    definir(`ombro_${sufixo}`, ombro);
    definir(`cotovelo_${sufixo}`, cotovelo);
    definir(`punho_${sufixo}`, punho);
    definir(`mindinho_${sufixo}`, mao);
    definir(`indicador_${sufixo}`, mao);
    definir(`polegar_${sufixo}`, mao);

    const rostoY = ombroY - 0.2;
    definir(`olho_interno_${sufixo}`, [s * 0.015 + balanco, rostoY - 0.03, -0.07]);
    definir(`olho_${sufixo}`, [s * 0.03 + balanco, rostoY - 0.03, -0.07]);
    definir(`olho_externo_${sufixo}`, [s * 0.045 + balanco, rostoY - 0.03, -0.06]);
    definir(`orelha_${sufixo}`, [s * 0.075 + balanco, rostoY - 0.02, 0]);
    definir(`boca_${sufixo}`, [s * 0.025 + balanco, rostoY + 0.04, -0.07]);
  }
  definir("nariz", [balanco, ombroY - 0.2, -0.08]);
  return pontos;
}

/** Gera um frame como o MediaPipe entregaria, com ruído opcional (em metros). */
export function gerarFrame(t: number, p: ParametrosPose, ruido = 0, aleatorio: () => number = Math.random): Frame {
  if (p.ausente) return { t, pontos: null, mundo: null };
  const corpo = esqueleto(p).map(
    (v): V3 =>
      ruido > 0
        ? [v[0] + ruido * gaussiano(aleatorio), v[1] + ruido * gaussiano(aleatorio), v[2] + ruido * gaussiano(aleatorio)]
        : v,
  );
  const qe = corpo[INDICE_PONTO.quadril_e];
  const qd = corpo[INDICE_PONTO.quadril_d];
  const centro: V3 = [(qe[0] + qd[0]) / 2, (qe[1] + qd[1]) / 2, (qe[2] + qd[2]) / 2];
  const visibilidade = p.visibilidade ?? 0.95;
  const pes = new Set(
    ["tornozelo_e", "tornozelo_d", "calcanhar_e", "calcanhar_d", "ponta_pe_e", "ponta_pe_d"].map((n) => INDICE_PONTO[n]),
  );

  const pontos: Ponto[] = corpo.map((v, i) => ({
    x: 0.5 + (v[0] * ESCALA) / PROPORCAO,
    y: CHAO_Y + v[1] * ESCALA,
    z: v[2] * ESCALA,
    visibility: pes.has(i) ? (p.visibilidadePes ?? visibilidade) : visibilidade,
  }));
  const mundo: Ponto[] = corpo.map((v) => ({ x: v[0] - centro[0], y: v[1] - centro[1], z: v[2] - centro[2] }));
  return { t, pontos, mundo };
}

/** Um trecho do roteiro: dura `s` segundos e devolve os parâmetros para u de 0 a 1. */
export interface Trecho {
  s: number;
  pose: (u: number) => ParametrosPose;
}

/** Transição suave de 0 a 1 (cosseno). */
export const suave = (u: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;
const interpolar = (a: number, b: number, u: number) => a + (b - a) * suave(u);

export function parado(s: number, pose: ParametrosPose = {}): Trecho {
  return { s, pose: () => pose };
}

export interface OpcoesAgachamento {
  fundo?: number;
  topo?: number;
  descida?: number;
  pausa?: number;
  subida?: number;
  descanso?: number;
  valgo?: number;
  extra?: ParametrosPose;
}

/** Uma repetição de agachamento: desce, segura no fundo, sobe e descansa em pé. */
export function agachamento(o: OpcoesAgachamento = {}): Trecho[] {
  const topo = o.topo ?? 174;
  const fundo = o.fundo ?? 85;
  const valgo = o.valgo ?? 0;
  const extra = o.extra ?? {};
  return [
    { s: o.descida ?? 0.7, pose: (u) => ({ ...extra, joelho: interpolar(topo, fundo, u), valgo: valgo * suave(u) }) },
    { s: o.pausa ?? 0.25, pose: () => ({ ...extra, joelho: fundo, valgo }) },
    { s: o.subida ?? 0.6, pose: (u) => ({ ...extra, joelho: interpolar(fundo, topo, u), valgo: valgo * (1 - suave(u)) }) },
    { s: o.descanso ?? 0.45, pose: () => ({ ...extra, joelho: topo }) },
  ];
}

export interface OpcoesPolichinelo {
  /** Metade da abertura dos pés no ponto aberto, em metros. */
  abertura?: number;
  /** Quanto os braços sobem, em graus. */
  bracos?: number;
  ida?: number;
  aberto?: number;
  volta?: number;
  fechado?: number;
}

export function polichinelo(o: OpcoesPolichinelo = {}): Trecho[] {
  const abertura = o.abertura ?? 0.36;
  const bracos = o.bracos ?? 170;
  const fechado: ParametrosPose = { pes: 0.07, bracos: 8, joelho: 172 };
  const aberto: ParametrosPose = { pes: abertura, bracos, joelho: 172 };
  const entre = (a: ParametrosPose, b: ParametrosPose, u: number): ParametrosPose => ({
    pes: interpolar(a.pes!, b.pes!, u),
    bracos: interpolar(a.bracos!, b.bracos!, u),
    joelho: 172,
  });
  return [
    { s: o.ida ?? 0.22, pose: (u) => entre(fechado, aberto, u) },
    { s: o.aberto ?? 0.2, pose: () => aberto },
    { s: o.volta ?? 0.22, pose: (u) => entre(aberto, fechado, u) },
    { s: o.fechado ?? 0.22, pose: () => fechado },
  ];
}

/** Apoio em uma perna: sobe o pé, segura com leve oscilação e desce. */
export function apoio(lado: "e" | "d", segundos: number, oscilacao = 0.006): Trecho[] {
  const pe = (h: number): ParametrosPose => (lado === "e" ? { peE: h } : { peD: h });
  return [
    { s: 0.3, pose: (u) => pe(0.25 * suave(u)) },
    {
      s: segundos - 0.3,
      pose: (u) => ({ ...pe(0.25), balanco: oscilacao * Math.sin(2 * Math.PI * u * segundos * 0.4) }),
    },
    { s: 0.3, pose: (u) => pe(0.25 * (1 - suave(u))) },
  ];
}

export function repetir(n: number, trecho: () => Trecho[]): Trecho[] {
  return Array.from({ length: n }, trecho).flat();
}

export interface OpcoesSequencia {
  fps?: number;
  /** Ruído por coordenada, em metros (padrão 3 mm). */
  ruido?: number;
  semente?: number;
}

/** Transforma um roteiro em frames. */
export function gerarSequencia(trechos: Trecho[], opcoes: OpcoesSequencia = {}): Frame[] {
  const fps = opcoes.fps ?? 30;
  const aleatorio = criarAleatorio(opcoes.semente ?? 7);
  const ruido = opcoes.ruido ?? 0.003;
  const frames: Frame[] = [];
  const total = trechos.reduce((s, tr) => s + tr.s, 0);
  let indice = 0;
  let inicio = 0;
  for (let i = 0; i / fps < total; i++) {
    const t = i / fps;
    while (indice < trechos.length - 1 && t >= inicio + trechos[indice].s) {
      inicio += trechos[indice].s;
      indice++;
    }
    const trecho = trechos[indice];
    const u = trecho.s > 0 ? (t - inicio) / trecho.s : 1;
    frames.push(gerarFrame(Math.round(t * 1000), trecho.pose(Math.min(1, u)), ruido, aleatorio));
  }
  return frames;
}

/** Roteiros das fixtures JSON guardadas em /fixtures (ver scripts/gerar-fixtures.ts). */
export const ROTEIROS: Record<string, Omit<Fixture, "frames" | "versao" | "origem" | "proporcao"> & { trechos: Trecho[] }> = {
  agachamento_10_reps: {
    exercicio: "agachamento_livre",
    descricao: "10 agachamentos completos (fundo a 85 graus), com ruído de 3 mm",
    esperado: { reps_validas: 10, reps_parciais: 0 },
    trechos: [parado(1.5, { joelho: 174 }), ...repetir(10, () => agachamento()), parado(1, { joelho: 174 })],
  },
  polichinelo_12_reps: {
    exercicio: "polichinelo",
    descricao: "12 polichinelos completos em ritmo de 70 por minuto",
    esperado: { reps_validas: 12, reps_parciais: 0 },
    trechos: [
      parado(1.5, { pes: 0.07, bracos: 8, joelho: 172 }),
      ...repetir(12, () => polichinelo()),
      parado(1, { pes: 0.07, bracos: 8, joelho: 172 }),
    ],
  },
  apoio_esquerdo_12s: {
    exercicio: "apoio_uma_perna",
    descricao: "Pé esquerdo no ar por 12 s com oscilação leve, depois pé no chão",
    esperado: { tempo_valido_s: 12, tolerancia: 0.5 },
    trechos: [parado(1.5), ...apoio("e", 12), parado(1)],
  },
};

export function fixtureDoRoteiro(nome: string): Fixture {
  const { trechos, ...resto } = ROTEIROS[nome];
  return {
    versao: 1,
    origem: "sintetica",
    proporcao: PROPORCAO,
    fps: 30,
    ...resto,
    frames: gerarSequencia(trechos).map(serializarFrame),
  };
}

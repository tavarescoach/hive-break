/**
 * Gabaritos: a posição esperada de cada exercício como figura de palito.
 * Coordenadas numa caixa de 100 × 100 (y para baixo). Exercícios de repetição
 * têm duas posições (início e meio do movimento) e a figura anima entre elas;
 * isometrias e posturas têm uma posição só.
 *
 * Nos exercícios de lado, a figura olha para a direita e o lado esquerdo do
 * corpo fica ao fundo (desenhado mais claro).
 */

export type NomePonto =
  | "cabeca" | "ombroE" | "ombroD" | "cotoveloE" | "cotoveloD" | "punhoE" | "punhoD"
  | "quadrilE" | "quadrilD" | "joelhoE" | "joelhoD" | "tornozeloE" | "tornozeloD";

export type Pose = Record<NomePonto, [number, number]>;

export interface Gabarito {
  poses: Pose[];
  /** Vista de lado (o lado esquerdo fica ao fundo). */
  lateral?: boolean;
  /** Desenha o cabo de vassoura entre as mãos. */
  bastao?: boolean;
  /** Dica curta mostrada junto da figura. */
  dica: string;
}

const FRENTE: Pose = {
  cabeca: [50, 12], ombroE: [40, 25], ombroD: [60, 25], cotoveloE: [37, 39], cotoveloD: [63, 39],
  punhoE: [36, 52], punhoD: [64, 52], quadrilE: [45, 52], quadrilD: [55, 52],
  joelhoE: [44, 70], joelhoD: [56, 70], tornozeloE: [44, 88], tornozeloD: [56, 88],
};

const LADO: Pose = {
  cabeca: [53, 12], ombroE: [49, 25], ombroD: [51, 25], cotoveloE: [49, 39], cotoveloD: [52, 39],
  punhoE: [50, 52], punhoD: [53, 52], quadrilE: [49, 52], quadrilD: [51, 52],
  joelhoE: [49, 70], joelhoD: [52, 70], tornozeloE: [48, 88], tornozeloD: [51, 88],
};

const f = (mudancas: Partial<Pose>): Pose => ({ ...FRENTE, ...mudancas });
const l = (mudancas: Partial<Pose>): Pose => ({ ...LADO, ...mudancas });
/** Os dois lados no mesmo lugar (vista de lado, membros sobrepostos). */
const ambos = (nome: "ombro" | "cotovelo" | "punho" | "quadril" | "joelho" | "tornozelo", p: [number, number], fundo: [number, number] = [p[0] - 2, p[1]]) =>
  ({ [`${nome}D`]: p, [`${nome}E`]: fundo }) as Partial<Pose>;

const PRANCHA_ALTA: Partial<Pose> = {
  cabeca: [82, 46], ...ambos("ombro", [74, 50]), ...ambos("cotovelo", [74, 63]), ...ambos("punho", [74, 76]),
  ...ambos("quadril", [48, 57]), ...ambos("joelho", [33, 63]), ...ambos("tornozelo", [16, 69]),
};

export const GABARITOS: Record<string, Gabarito> = {
  agachamento_livre: {
    dica: "Pés na largura dos ombros; desça até as coxas ficarem paralelas ao chão.",
    poses: [
      f({ cotoveloE: [40, 36], punhoE: [44, 36], cotoveloD: [60, 36], punhoD: [56, 36] }),
      f({
        cabeca: [50, 30], ombroE: [40, 43], ombroD: [60, 43], cotoveloE: [40, 50], punhoE: [45, 50], cotoveloD: [60, 50], punhoD: [55, 50],
        quadrilE: [43, 66], quadrilD: [57, 66], joelhoE: [35, 70], joelhoD: [65, 70], tornozeloE: [42, 88], tornozeloD: [58, 88],
      }),
    ],
  },
  polichinelo: {
    dica: "Abra as pernas e leve as mãos acima da cabeça; volte com os pés juntos.",
    poses: [
      f({ joelhoE: [47, 70], joelhoD: [53, 70], tornozeloE: [47, 88], tornozeloD: [53, 88], cotoveloE: [39, 39], cotoveloD: [61, 39], punhoE: [40, 52], punhoD: [60, 52] }),
      f({ cotoveloE: [32, 13], punhoE: [38, 2], cotoveloD: [68, 13], punhoD: [62, 2], joelhoE: [38, 70], joelhoD: [62, 70], tornozeloE: [30, 88], tornozeloD: [70, 88] }),
    ],
  },
  apoio_uma_perna: {
    dica: "Tire um pé do chão e segure, com o tronco reto.",
    poses: [f({ joelhoD: [58, 62], tornozeloD: [58, 77], cotoveloE: [33, 38], punhoE: [28, 49], cotoveloD: [67, 38], punhoD: [72, 49] })],
  },
  afundo_alternado: {
    lateral: true,
    dica: "Passo para trás; o joelho da frente fica sobre o pé e o de trás desce perto do chão.",
    poses: [
      l({}),
      l({
        cabeca: [52, 22], ...ambos("ombro", [50, 35]), ...ambos("cotovelo", [50, 48]), ...ambos("punho", [51, 60]),
        ...ambos("quadril", [48, 62]), joelhoD: [62, 66], tornozeloD: [62, 88], joelhoE: [40, 82], tornozeloE: [27, 86],
      }),
    ],
  },
  flexao_braco: {
    lateral: true,
    dica: "Corpo reto da cabeça aos pés; desça o peito até o cotovelo dobrar 90°.",
    poses: [
      l(PRANCHA_ALTA),
      l({ ...PRANCHA_ALTA, cabeca: [83, 61], ...ambos("ombro", [74, 65]), ...ambos("cotovelo", [65, 60]), ...ambos("quadril", [48, 68]), ...ambos("joelho", [33, 72]), ...ambos("tornozelo", [16, 75]) }),
    ],
  },
  ponte_gluteo: {
    lateral: true,
    dica: "Deitado, joelhos dobrados: suba o quadril até alinhar ombro, quadril e joelho.",
    poses: [
      l({ cabeca: [16, 74], ...ambos("ombro", [24, 74]), ...ambos("cotovelo", [33, 77]), ...ambos("punho", [42, 77]), ...ambos("quadril", [50, 75]), ...ambos("joelho", [63, 58]), ...ambos("tornozelo", [70, 77]) }),
      l({ cabeca: [16, 74], ...ambos("ombro", [24, 72]), ...ambos("cotovelo", [33, 77]), ...ambos("punho", [42, 77]), ...ambos("quadril", [46, 58]), ...ambos("joelho", [63, 52]), ...ambos("tornozelo", [70, 77]) }),
    ],
  },
  prancha: {
    lateral: true,
    dica: "Antebraços no chão, corpo reto: nem quadril caído, nem quadril alto.",
    poses: [l({ cabeca: [82, 54], ...ambos("ombro", [74, 58]), ...ambos("cotovelo", [74, 72]), ...ambos("punho", [86, 72]), ...ambos("quadril", [48, 62]), ...ambos("joelho", [33, 66]), ...ambos("tornozelo", [16, 70]) })],
  },
  skipping: {
    dica: "Corra no lugar levando cada joelho até a altura do quadril.",
    poses: [
      f({ joelhoE: [39, 53], tornozeloE: [41, 69], cotoveloD: [63, 33], punhoD: [59, 26], cotoveloE: [36, 42], punhoE: [33, 54] }),
      f({ joelhoD: [61, 53], tornozeloD: [59, 69], cotoveloE: [37, 33], punhoE: [41, 26], cotoveloD: [64, 42], punhoD: [67, 54] }),
    ],
  },
  mountain_climber: {
    lateral: true,
    dica: "Em prancha alta, leve um joelho de cada vez em direção ao peito.",
    poses: [
      l({ ...PRANCHA_ALTA, joelhoD: [60, 63], tornozeloD: [49, 71] }),
      l({ ...PRANCHA_ALTA, joelhoE: [58, 63], tornozeloE: [47, 71] }),
    ],
  },
  elevacao_bracos_y: {
    dica: "Suba os braços estendidos formando um Y e desça devagar.",
    poses: [f({}), f({ cotoveloE: [32, 12], punhoE: [25, 1], cotoveloD: [68, 12], punhoD: [75, 1] })],
  },
  alongamento_posterior: {
    lateral: true,
    dica: "Joelhos estendidos; incline o tronco à frente e solte os braços.",
    poses: [l({ cabeca: [73, 68], ...ambos("ombro", [66, 60]), ...ambos("cotovelo", [66, 71]), ...ambos("punho", [66, 81]), ...ambos("quadril", [46, 52]), ...ambos("joelho", [47, 70]), ...ambos("tornozelo", [47, 88]) })],
  },
  marcha_estacionaria: {
    dica: "Marche no lugar subindo os joelhos e balançando o braço oposto.",
    poses: [
      f({ joelhoE: [40, 60], tornozeloE: [42, 77], cotoveloD: [63, 34], punhoD: [60, 28] }),
      f({ joelhoD: [60, 60], tornozeloD: [58, 77], cotoveloE: [37, 34], punhoE: [40, 28] }),
    ],
  },
  guerreiro_2: {
    dica: "Pernas afastadas, joelho da frente a 90°; braços abertos na altura dos ombros.",
    poses: [
      f({
        cabeca: [53, 16], ombroE: [42, 28], ombroD: [62, 28], cotoveloE: [28, 28], punhoE: [14, 28], cotoveloD: [76, 28], punhoD: [90, 28],
        quadrilE: [46, 56], quadrilD: [56, 56], joelhoE: [35, 72], tornozeloE: [24, 88], joelhoD: [70, 64], tornozeloD: [72, 88],
      }),
    ],
  },
  postura_arvore: {
    dica: "Planta do pé apoiada na perna de apoio, mãos unidas acima da cabeça.",
    poses: [f({ joelhoD: [68, 63], tornozeloD: [48, 70], cotoveloE: [40, 10], punhoE: [49, 1], cotoveloD: [60, 10], punhoD: [51, 1] })],
  },
  cachorro_olhando_baixo: {
    lateral: true,
    dica: "Mãos e pés no chão, quadril no alto em V invertido; joelhos e cotovelos estendidos.",
    poses: [l({ cabeca: [74, 70], ...ambos("ombro", [72, 62]), ...ambos("cotovelo", [77, 71]), ...ambos("punho", [82, 80]), ...ambos("quadril", [50, 36]), ...ambos("joelho", [38, 58]), ...ambos("tornozelo", [26, 80]) })],
  },
  toque_alvos: {
    dica: "Toque cada círculo que aparecer na tela com a mão.",
    poses: [f({}), f({ cotoveloD: [70, 17], punhoD: [80, 8] }), f({}), f({ cotoveloE: [30, 17], punhoE: [20, 8] })],
  },
  respiracao_guiada: {
    dica: "Sentado ou em pé, parado: inspire em 4 s e solte o ar em 6 s.",
    poses: [
      f({
        cabeca: [50, 32], ombroE: [40, 44], ombroD: [60, 44], cotoveloE: [36, 57], cotoveloD: [64, 57], punhoE: [37, 70], punhoD: [63, 70],
        quadrilE: [45, 70], quadrilD: [55, 70], joelhoE: [29, 78], joelhoD: [71, 78], tornozeloE: [46, 84], tornozeloD: [54, 84],
      }),
    ],
  },
  agachamento_bastao: {
    bastao: true,
    dica: "Bastão acima da cabeça, braços estendidos o tempo todo; agache sem deixá-lo cair.",
    poses: [
      f({ cotoveloE: [34, 14], punhoE: [30, 3], cotoveloD: [66, 14], punhoD: [70, 3] }),
      f({
        cabeca: [50, 30], ombroE: [40, 43], ombroD: [60, 43], cotoveloE: [34, 31], punhoE: [30, 20], cotoveloD: [66, 31], punhoD: [70, 20],
        quadrilE: [43, 66], quadrilD: [57, 66], joelhoE: [35, 70], joelhoD: [65, 70], tornozeloE: [42, 88], tornozeloD: [58, 88],
      }),
    ],
  },
  bom_dia_bastao: {
    lateral: true,
    dica: "Bastão nas costas; incline o tronco à frente com os joelhos quase estendidos.",
    poses: [
      l({ ...ambos("cotovelo", [44, 27]), ...ambos("punho", [50, 23]) }),
      l({ cabeca: [76, 40], ...ambos("ombro", [68, 41]), ...ambos("cotovelo", [62, 34]), ...ambos("punho", [68, 34]), ...ambos("quadril", [46, 52]), ...ambos("joelho", [49, 70]), ...ambos("tornozelo", [47, 88]) }),
    ],
  },
};

/** Ligações da figura (pares de pontos). */
export const LIGACOES_FIGURA: [NomePonto, NomePonto][] = [
  ["ombroE", "ombroD"], ["quadrilE", "quadrilD"],
  ["ombroE", "cotoveloE"], ["cotoveloE", "punhoE"], ["ombroD", "cotoveloD"], ["cotoveloD", "punhoD"],
  ["ombroE", "quadrilE"], ["ombroD", "quadrilD"],
  ["quadrilE", "joelhoE"], ["joelhoE", "tornozeloE"], ["quadrilD", "joelhoD"], ["joelhoD", "tornozeloD"],
];

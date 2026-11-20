/**
 * Tipos do motor de análise de movimento (seção 8 da especificação).
 * O motor é TypeScript puro: não depende de DOM, câmera nem MediaPipe.
 */

/** Um ponto do corpo. Em imagem: x e y de 0 a 1. Em mundo: metros, origem no meio do quadril. */
export interface Ponto {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Um frame de pose. `pontos` e `mundo` têm 33 itens na ordem do MediaPipe. */
export interface Frame {
  /** Tempo em milissegundos (monotônico). */
  t: number;
  /** Pontos normalizados na imagem, ou null quando nenhuma pessoa foi detectada. */
  pontos: Ponto[] | null;
  /** Pontos 3D em metros (worldLandmarks). Usados nos ângulos com `espaco: "3d"`. */
  mundo?: Ponto[] | null;
}

export type Lado = "e" | "d";
/**
 * "visivel" usa o lado que a câmera enxerga melhor (exercícios de lado para o celular).
 * "centro" mede uma vez só, com cada nome sem sufixo virando o ponto médio entre
 * esquerda e direita (ex.: ângulo tornozelo_e–quadril–tornozelo_d na abdução em pé).
 */
export type CombinarLados = Lado | "media" | "min" | "max" | "visivel" | "centro";
export type Espaco = "2d" | "3d";

interface MedidaBase {
  /**
   * Como tratar nomes de ponto sem sufixo (ex.: "joelho").
   * Com `lado`, a medida é calculada por lado e combinada. Sem `lado`, o nome
   * sem sufixo vira o ponto médio entre esquerda e direita.
   */
  lado?: CombinarLados;
}

/** Ângulo no ponto do meio, em graus (180 = segmento reto). */
export interface MedidaAngulo extends MedidaBase {
  tipo: "angulo";
  pontos: [string, string, string];
  /** "3d" usa os pontos de mundo (padrão); "2d" usa a imagem. */
  espaco?: Espaco;
}

/** Distância entre dois pontos na imagem, opcionalmente dividida por outra distância. */
export interface MedidaDistancia extends MedidaBase {
  tipo: "distancia";
  pontos: [string, string];
  normalizar_por?: [string, string];
}

/**
 * Diferença de altura na imagem: positiva quando o segundo ponto está acima do
 * primeiro. Opcionalmente dividida por uma distância de referência.
 */
export interface MedidaAltura extends MedidaBase {
  tipo: "altura";
  pontos: [string, string];
  normalizar_por?: [string, string];
}

/**
 * Deslocamento horizontal na imagem: b.x − a.x (positivo quando b está à direita
 * de a na imagem), opcionalmente dividido por uma distância de referência. Use
 * `abs()` na condição quando o lado não importa (ex.: mãos no centro do peito no Pallof).
 */
export interface MedidaHorizontal extends MedidaBase {
  tipo: "horizontal";
  pontos: [string, string];
  normalizar_por?: [string, string];
}

/** Inclinação do segmento a→b em relação à vertical, na imagem: 0 = em pé, 90 = deitado. */
export interface MedidaInclinacao extends MedidaBase {
  tipo: "inclinacao";
  pontos: [string, string];
}

/**
 * Quanto o corpo está se mexendo: velocidade média dos pontos, em "larguras de
 * referência por segundo". Usada na respiração guiada (a pessoa precisa ficar parada).
 */
export interface MedidaMovimento {
  tipo: "movimento";
  pontos: string[];
  normalizar_por: [string, string];
  lado?: undefined;
}

export type DefinicaoMedida = MedidaAngulo | MedidaDistancia | MedidaAltura | MedidaHorizontal | MedidaInclinacao | MedidaMovimento;

export interface DefinicaoFase {
  nome: string;
  condicao: string;
  /** Folga para sair da fase. Padrão: `histerese` da definição. */
  histerese?: number;
}

export interface DefinicaoErro {
  id: string;
  condicao: string;
  feedback: string;
  /** Só avalia enquanto esta fase é a atual. Sem fase: avalia sempre. */
  fase?: string;
  /**
   * "durante" (padrão): avaliado a cada frame, precisa durar `erro_minimo_ms`.
   * "fim_rep": avaliado uma vez ao fechar a repetição, com min_/max_ das medidas.
   */
  quando?: "durante" | "fim_rep";
  /** Se verdadeiro, a repetição com este erro vira parcial (não soma). */
  invalida?: boolean;
  histerese?: number;
  /** Pontos do corpo envolvidos (para colorir só o segmento errado do esqueleto). Sem isso, o esqueleto inteiro fica coral. */
  pontos?: string[];
}

export interface DefinicaoAmplitude {
  /** Qual extremo da medida principal representa a amplitude. */
  extremo: "min" | "max";
  /** Valor que vale 0 (mínimo aceito para a repetição ser válida). */
  minimo_aceito: number;
  /** Valor que vale 1 (execução ideal). */
  ideal: number;
}

export type Formato = "repeticoes" | "alternado" | "isometria" | "equilibrio" | "postura" | "respiracao" | "precisao";

/**
 * Exercício alternado (marcha, skipping, mountain climber): cada lado conta uma
 * repetição quando a condição dele fica verdadeira, e só volta a contar depois
 * que ela deixa de valer.
 */
export interface DefinicaoAlternado {
  e: string;
  d: string;
  /** "Quase": o movimento começou mas não chegou lá. Vira repetição parcial. */
  quase_e?: string;
  quase_d?: string;
}

/** Toque nos alvos: alvos aparecem ao alcance das mãos e somem depois de um tempo. */
export interface DefinicaoAlvos {
  /** Pontos que acertam o alvo (ex.: punho_e, punho_d). */
  pontos: string[];
  /** Tempo para acertar cada alvo. */
  tempo_ms: number;
  /** Raio do alvo, em larguras de ombro. */
  raio: number;
  /** Pausa entre um alvo e o próximo. */
  intervalo_ms?: number;
}

/** Bloco de sustentação: isometria, postura e equilíbrio. */
export interface DefinicaoSustentacao {
  /** Enquanto for verdadeira, o tempo válido corre. */
  condicao: string;
  histerese?: number;
  /** Frase quando a posição é perdida depois de ter sido mantida. */
  feedback_perda?: string;
  /** Medida cujo sinal diz qual lado está em ação (ex.: qual pé saiu do chão). */
  lado?: { medida: string; positivo: Lado; negativo: Lado };
  /** Ponto de controle para medir oscilação (ex.: quadril). */
  controle?: { ponto: string; normalizar_por: [string, string]; oscilacao_maxima: number };
  /**
   * Quantas vezes a posição pode ser perdida e recuperada sem terminar a
   * sustentação nem perder o tempo já creditado (ex.: apoio_uma_perna_com_toque:
   * o pé livre pode tocar o chão até 2 vezes por série). O tempo não corre
   * durante o toque; passado o limite, a próxima perda encerra a posição.
   */
  toques_tolerados?: number;
}

export interface DefinicaoExercicio {
  id: string;
  nome: string;
  modalidade: string;
  camera: "frontal" | "lateral";
  formato: Formato;
  /** Ritmo de referência em segundos por repetição (planejamento da duração dos desafios). */
  seg_por_rep?: number;
  /** Pontos que precisam estar visíveis (> visibilidade mínima) para o frame valer. */
  pontos_obrigatorios: string[];
  /**
   * "meio_corpo": só da cintura para cima (sentado, celular no monitor). O aviso de
   * posição não confere de frente/de lado pelo quadril quando o quadril não aparece.
   * Padrão: "corpo_inteiro".
   */
  enquadramento?: "corpo_inteiro" | "meio_corpo";
  /** Medida principal: aparece nas condições como `medida`. */
  medida_principal: DefinicaoMedida;
  /** Medidas extras, usadas pelo nome nas condições. */
  medidas?: Record<string, DefinicaoMedida>;
  /** Folga padrão das fases, na unidade da medida (5 = 5 graus). */
  histerese?: number;

  // --- formato "repeticoes" ---
  fases?: DefinicaoFase[];
  /** Sequência de fases que forma uma repetição, ex.: ["topo", "fundo", "topo"]. */
  repeticao?: string[];
  /** Condição avaliada quando a pessoa volta ao início sem completar a sequência. */
  parcial_se?: string;
  parcial_feedback?: string;
  amplitude?: DefinicaoAmplitude;
  /** Duração mínima de uma repetição completa (antifraude). Padrão 400 ms. */
  duracao_minima_ms?: number;
  /** Duração mínima de cada fase. Padrão 150 ms. */
  fase_minima_ms?: number;

  // --- formato "alternado" ---
  alternado?: DefinicaoAlternado;

  // --- formato "precisao" ---
  alvos?: DefinicaoAlvos;

  // --- formatos de sustentação (isometria, postura, equilíbrio, respiração) ---
  sustentacao?: DefinicaoSustentacao;

  erros?: DefinicaoErro[];
  /** Tempo mínimo de um erro "durante" para ser registrado. Padrão 150 ms. */
  erro_minimo_ms?: number;
  kpis?: string[];
  variacao_facil?: string;
  alternativas?: Record<string, string>;
  /** Instruções curtas para a tela de preparação. */
  instrucoes?: string[];
}

export interface RegistroRep {
  /** Momento em que a repetição fechou. */
  t: number;
  valida: boolean;
  /** Lado que fez a repetição, nos exercícios alternados. */
  lado?: Lado;
  motivo?: "amplitude" | "rapida" | string;
  duracaoMs: number;
  /** Do início do movimento até o extremo (fase excêntrica no agachamento). */
  tempoIdaMs: number;
  /** Do extremo até voltar ao início (fase concêntrica no agachamento). */
  tempoVoltaMs: number;
  /** Valor extremo da medida principal. */
  extremo: number;
  /** Amplitude normalizada de 0 a 1, quando a definição tem `amplitude`. */
  amplitude: number | null;
  erros: string[];
}

export type EventoMotor =
  | { tipo: "rep_valida"; t: number; total: number; rep: RegistroRep }
  | { tipo: "rep_parcial"; t: number; total: number; rep: RegistroRep; feedback?: string }
  | { tipo: "rep_rapida"; t: number; rep: RegistroRep }
  | { tipo: "erro"; t: number; id: string; feedback: string }
  | { tipo: "fase"; t: number; fase: string }
  | { tipo: "posicao_inicio"; t: number; lado: Lado | null }
  | { tipo: "posicao_perdida"; t: number; lado: Lado | null; duracaoMs: number; feedback?: string }
  | { tipo: "alvo_acerto"; t: number; total: number; reacaoMs: number }
  | { tipo: "alvo_perdido"; t: number }
  | { tipo: "fora_quadro"; t: number }
  | { tipo: "voltou_quadro"; t: number };

export interface EstadoMotor {
  repsValidas: number;
  repsParciais: number;
  repsRapidas: number;
  /** Tempo acumulado na posição (formatos de sustentação). */
  tempoValidoMs: number;
  /** Fase atual confirmada (formato de repetições). */
  fase: string | null;
  /** Se a posição está sendo mantida agora (formatos de sustentação). */
  naPosicao: boolean;
  lado: Lado | null;
  foraDoQuadro: boolean;
  /** O último frame foi usado (pontos obrigatórios visíveis). */
  frameValido: boolean;
  /** Erros ativos neste momento (para pintar o esqueleto de vermelho). */
  errosAtivos: string[];
  /**
   * Índices dos pontos do(s) erro(s) ativo(s), para colorir só o segmento errado.
   * Vazio com `errosAtivos` não vazio: nenhum erro ativo tem `pontos` definido,
   * então o esqueleto inteiro fica coral (ver `desenharEsqueleto`).
   */
  segmentoErro: number[];
  /** Últimos valores das medidas, com `medida` sendo a principal. */
  medidas: Record<string, number>;
  /** Alvo na tela agora (formato precisão), em coordenadas da imagem de 0 a 1. */
  alvo: { x: number; y: number; raio: number } | null;
}

export interface OpcoesMotor {
  /** Largura dividida pela altura da imagem (corrige a distorção de x). Padrão 1. */
  proporcao?: number;
  /** Visibilidade mínima dos pontos obrigatórios. Padrão 0,6. */
  visibilidadeMinima?: number;
  /** Tempo sem frame válido até avisar "fora do quadro". Padrão 1000 ms. */
  foraQuadroMs?: number;
  /** Liga a suavização One Euro. Padrão: ligada. */
  suavizar?: boolean;
  /** Gerador de números aleatórios (posição dos alvos). Padrão: Math.random. */
  aleatorio?: () => number;
}

export interface Kpis {
  reps_validas: number;
  reps_parciais: number;
  reps_rapidas: number;
  reps_e: number;
  reps_d: number;
  acertos: number;
  alvos_perdidos: number;
  precisao: number | null;
  tempo_reacao: number | null;
  /** Fração do tempo de trabalho em que a posição foi mantida (isometria, respiração). */
  pct_tempo_valido: number | null;
  amplitude_media: number | null;
  tempo_excentrico: number | null;
  tempo_concentrico: number | null;
  tempo_sob_tensao: number | null;
  cadencia: number | null;
  regularidade: number | null;
  indice_tecnico: number | null;
  tempo_valido_s: number;
  tempo_valido_e_s: number;
  tempo_valido_d_s: number;
  maior_sustentacao_s: number;
  oscilacao: number | null;
  estabilidade: number | null;
  simetria: number | null;
  perdas_posicao: number;
  tempo_trabalho_s: number;
  fora_quadro_pct: number;
  erros: Record<string, number>;
}

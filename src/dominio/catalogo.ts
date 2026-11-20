/**
 * Catálogo estendido (Etapa 1B do docs/PLANO_ETAPAS_UX.md): metadados de
 * contexto e substituição por cima do que o motor já usa. O motor lê só os
 * campos de src/motor/tipos.ts; tudo daqui vive numa chave `catalogo`
 * separada em cada src/exercicios/*.json, que o motor ignora.
 *
 * Decisão (docs/DECISOES.md, seção "Etapa 1A", e Resultado da Etapa 0): JSON
 * é a fonte, validado por este schema; o validador (scripts/validar-catalogo.ts)
 * roda sem telas, sem banco — só os arquivos.
 */
import { z } from "zod";

// ============================================================== exercício

/** Até 3 funções por exercício: o que o movimento treina (não a região). */
export const FUNCOES = [
  "agachar", "dobrar", "avancar", "empurrar", "puxar", "carregar",
  "anti-extensao", "anti-rotacao", "anti-inclinacao", "flexao-coluna", "extensao-coluna", "rotacao",
  "equilibrio", "mobilidade", "alongamento", "potencia", "cardio", "golpe", "respiracao", "relaxamento",
] as const;
export const Funcao = z.enum(FUNCOES);
export type Funcao = z.infer<typeof Funcao>;

/**
 * Região do corpo mais trabalhada. Sem lista fechada nos docs da Etapa 1B;
 * esta é a nossa escolha [validar], pensada para filtro grosso (não
 * anatomia exata).
 */
export const REGIOES = [
  "pernas", "gluteos", "quadril", "core", "lombar", "peito", "ombros", "bracos", "tornozelos", "corpo_todo",
  "pescoco", "costas", "punho",
] as const;
export const Regiao = z.enum(REGIOES);
export type Regiao = z.infer<typeof Regiao>;

export const PosicaoCamera = z.enum(["frente", "lado", "45", "aos-pes"]);
export type PosicaoCamera = z.infer<typeof PosicaoCamera>;

/**
 * V1 repetições/alternado (sequência de fases); V2 sustentação (isometria,
 * postura, equilíbrio, respiração: o motor usa o mesmo bloco `sustentacao`
 * para os quatro); V3 precisão (alvos); V4 guiado, sem regra de câmera
 * (reservado para quando a biblioteca da Etapa 1C trouxer exercício sem
 * validação ainda — nenhum dos 23 de hoje usa V4).
 */
export const Validacao = z.enum(["V1", "V2", "V3", "V4"]);
export type Validacao = z.infer<typeof Validacao>;

/** E0 só o corpo; E1 objeto de casa improvisado; E2 acessório comum; E3 equipamento dedicado. */
export const Equipamento = z.enum(["E0", "E1", "E2", "E3"]);
export type Equipamento = z.infer<typeof Equipamento>;

/** Peso do exercício numa trilha: Principal, Secundário ou Extra. */
export const Peso = z.enum(["P", "S", "E"]);
export type Peso = z.infer<typeof Peso>;

/**
 * Cada flag é auto-descritiva: `true` = o exercício NÃO exige aquilo (ex.:
 * `semSalto: true` = não tem fase de voo). Mesmos nomes de `Contexto.regras`
 * de propósito: o filtro por contexto (Etapa 2) compara flag a flag.
 */
export const Flags = z.object({
  semChao: z.boolean(),
  semSalto: z.boolean(),
  /** "Dá para fazer sem suar numa dose leve" (decisão do Luan) — não é "nunca cansa". */
  semSuor: z.boolean(),
  silencioso: z.boolean(),
});
export type Flags = z.infer<typeof Flags>;

export const ExercicioCatalogo = z.object({
  nome: z.string().min(1),
  /** Nome de origem (ex.: da biblioteca importada na Etapa 1C), quando `nome` é uma renomeação. */
  nomeOriginal: z.string().min(1).optional(),
  /** Agrupa variações do mesmo movimento (ex.: "agachamento"); usado para achar substituto por função+degrau. */
  familia: z.string().min(1),
  /** Id do exercício do qual este é variação (mais fácil ou mais difícil). */
  variacaoDe: z.string().min(1).optional(),
  /** Posição na escada de dificuldade da família: 0 = mais fácil. */
  degrau: z.number().int().min(0),
  funcoes: z.array(Funcao).min(1).max(3),
  regioes: z.array(Regiao).min(1),
  posicaoCamera: PosicaoCamera,
  validacao: Validacao,
  equipamento: Equipamento,
  /** Ids de public.content/objetos.json usados (vazio quando `equipamento` é E0). */
  objetos: z.array(z.string().min(1)).default([]),
  /** Obrigatório para E1–E3 (regra do validador): id do equivalente E0. */
  substitutoE0Id: z.string().min(1).optional(),
  /** Obrigatório quando `flags.semSalto` é falso (tem fase de voo): id da versão sem impacto. */
  versaoSemImpactoId: z.string().min(1).optional(),
  flags: Flags,
  /** Peso por trilha (id da trilha → P/S/E). Vazio até existirem trilhas nomeadas além da principal. */
  pesoPorTrilha: z.record(z.string(), Peso).default({}),
  /** Testado com pessoas reais (decisão 55 de docs/DECISOES.md). */
  calibrado: z.boolean(),
});
export type ExercicioCatalogo = z.infer<typeof ExercicioCatalogo>;

// =================================================================== objeto

export const Pegada = z.enum(["uma-mao", "duas-maos", "alca", "abracado"]);
export type Pegada = z.infer<typeof Pegada>;

export const Objeto = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  cargaKgMin: z.number().min(0),
  cargaKgMax: z.number().min(0),
  pegada: Pegada,
  /** Frase curta de segurança (ex.: "Cadeira sem rodinha, encostada na parede."). */
  seguranca: z.string().min(1),
  /** Classe do detector de objetos (COCO), quando houver mapeamento automático. */
  cocoClass: z.string().min(1).optional(),
});
export type Objeto = z.infer<typeof Objeto>;

// ================================================================= contexto

export const ID_CONTEXTO = ["mesa", "sala", "plantao", "viagem", "casa", "ar-livre"] as const;
export const IdContexto = z.enum(ID_CONTEXTO);
export type IdContexto = z.infer<typeof IdContexto>;

export const RegrasContexto = z.object({
  semChao: z.boolean(),
  semSalto: z.boolean(),
  /** Mesma definição de `Flags.semSuor`: "dá para fazer sem suar numa dose leve". */
  semSuor: z.boolean(),
  silencioso: z.boolean(),
  interrompivel: z.boolean(),
});
export type RegrasContexto = z.infer<typeof RegrasContexto>;

export const Contexto = z.object({
  id: IdContexto,
  nome: z.string().min(1),
  regras: RegrasContexto,
});
export type Contexto = z.infer<typeof Contexto>;

// ==================================================================== lição

/** Cada variante aponta para outra lição (mesmo formato), não para dados inline. */
export const LicaoVariantes = z
  .object({
    curta3: z.string().min(1).optional(),
    snack1: z.string().min(1).optional(),
    avancada: z.string().min(1).optional(),
    improvisada: z.string().min(1).optional(),
    acessorio: z.string().min(1).optional(),
    semImpacto: z.string().min(1).optional(),
  })
  .default({});
export type LicaoVariantes = z.infer<typeof LicaoVariantes>;

export const BlocoLicao = z.object({
  exercicioId: z.string().min(1),
  series: z.number().int().positive(),
  /** Segundos de esforço por série (AMRAP/isometria). Ausente nos blocos por repetição. */
  esforcoS: z.number().positive().optional(),
  pausaS: z.number().min(0),
  /**
   * Percepção de esforço esperada, de 1 a 10 (igual a `Bloco.pse_alvo` em
   * src/dominio/metodos.ts). O validador recusa lição no contexto "mesa" com
   * algum bloco de PSE acima de 4 (decisão do Luan).
   */
  pseAlvo: z.number().min(1).max(10).optional(),
});
export type BlocoLicao = z.infer<typeof BlocoLicao>;

export const Licao = z.object({
  id: z.string().min(1),
  /** Seção/nível a que pertence (para a regra "1 exercício novo por lição"). */
  secaoId: z.string().min(1),
  /** Posição dentro da seção, para saber a ordem em que os exercícios aparecem pela primeira vez. */
  ordem: z.number().int().positive(),
  titulo: z.string().min(1),
  blocos: z.array(BlocoLicao).min(1),
  pausaEntreBlocosS: z.number().min(0).default(0),
  /** Duração mostrada na tela, em segundos. O validador confere contra o cálculo dos blocos. */
  duracaoExibidaS: z.number().int().positive(),
  /** Pelo menos um contexto (Etapa 2) em que a lição pode ser feita. */
  contextos: z.array(IdContexto).min(1),
  variantes: LicaoVariantes,
});
export type Licao = z.infer<typeof Licao>;

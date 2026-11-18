/**
 * Ganchos de convite (docs/GANCHOS_CONVITE.md, seção 2). Dado puro, sem lógica de
 * escolha — isso fica em src/dominio/ganchos.ts.
 */

export type Familia = "D" | "B" | "C";

/** Onde este gancho pode aparecer. Hoje só existe o card pós-treino. */
export type Contexto = "compartilhar_treino";

export interface Gancho {
  id: string;
  familia: Familia;
  texto: string;
  contextos: Contexto[];
}

const TODOS: Contexto[] = ["compartilhar_treino"];

/** Desafio (seção 2.1). */
const DESAFIO: Gancho[] = [
  { id: "D01", familia: "D", texto: "{nome} fez {reps} {exercicio} em {tempo}. Você bate?", contextos: TODOS },
  { id: "D02", familia: "D", texto: "Aguenta 30 segundos de prancha? Prova aí.", contextos: TODOS },
  { id: "D03", familia: "D", texto: "Fiz {reps} agachamentos em 1 minuto. Sua vez.", contextos: TODOS },
  { id: "D04", familia: "D", texto: "Meu recorde: {reps}. Vem tentar tirar ele de mim.", contextos: TODOS },
  { id: "D05", familia: "D", texto: "Te desafiei num break de 3 min. Aceita?", contextos: TODOS },
  { id: "D06", familia: "D", texto: "{dias} dias seguidos. Quantos você aguenta?", contextos: TODOS },
  { id: "D07", familia: "D", texto: "Quem faz mais polichinelos em 1 minuto: eu ou você?", contextos: TODOS },
  { id: "D08", familia: "D", texto: "Revanche aberta: {reps} reps. Topa?", contextos: TODOS },
  { id: "D09", familia: "D", texto: "Prancha de 45 s. Fiz. E você?", contextos: TODOS },
  { id: "D10", familia: "D", texto: "Quanto agachamento você faz em 40 segundos?", contextos: TODOS },
  { id: "D11", familia: "D", texto: "Desafio rápido: cabe entre uma reunião e outra.", contextos: TODOS },
  { id: "D12", familia: "D", texto: "1 minuto. Máximo de repetições. Valendo.", contextos: TODOS },
  { id: "D13", familia: "D", texto: "Meu placar tá sozinho no topo. Vem.", contextos: TODOS },
  { id: "D14", familia: "D", texto: "3 minutos. A câmera conta, você só mexe.", contextos: TODOS },
  { id: "D15", familia: "D", texto: "Duvido você fechar 3 minutos sem parar.", contextos: TODOS },
];

/** Benefício (seção 2.2). */
const BENEFICIO: Gancho[] = [
  { id: "B01", familia: "B", texto: "Isso tá me ajudando com a lombar. Faz comigo?", contextos: TODOS },
  { id: "B02", familia: "B", texto: "3 minutos e a tarde ficou bem menos pesada.", contextos: TODOS },
  { id: "B03", familia: "B", texto: "Levantar a cada 30 min alivia a lombar. Bora?", contextos: TODOS },
  { id: "B04", familia: "B", texto: "2 minutos por dia pro pescoço parar de reclamar.", contextos: TODOS },
  { id: "B05", familia: "B", texto: "Sentado o dia todo? 3 minutos já mudam a tarde.", contextos: TODOS },
  { id: "B06", familia: "B", texto: "Meu pescoço agradece. O seu também vai.", contextos: TODOS },
  { id: "B07", familia: "B", texto: "Uma pausa de 3 min pra recuperar a energia das 15h.", contextos: TODOS },
  { id: "B08", familia: "B", texto: "Lombar travada de tanto sentar? Achei um jeito de mexer.", contextos: TODOS },
  { id: "B09", familia: "B", texto: "Não é academia: 3 minutos no meio do expediente.", contextos: TODOS },
  { id: "B10", familia: "B", texto: "Volto pra mesa mais leve. Testa uma vez.", contextos: TODOS },
  { id: "B11", familia: "B", texto: "Fortalecer lombar e abdômen reduz o risco de dor nas costas. Bora?", contextos: TODOS },
  { id: "B12", familia: "B", texto: "Menos cansaço e mais humor em 5 minutos de break.", contextos: TODOS },
  { id: "B13", familia: "B", texto: "Cuidar da coluna sem sair da sala. 3 minutos.", contextos: TODOS },
  { id: "B14", familia: "B", texto: "Ombro duro de tanta call? Esse break ajudou meu dia.", contextos: TODOS },
  { id: "B15", familia: "B", texto: "Saúde que cabe entre duas reuniões.", contextos: TODOS },
];

/** Companhia (seção 2.3). */
const COMPANHIA: Gancho[] = [
  { id: "C01", familia: "C", texto: "Bora um break de 3 minutos comigo?", contextos: TODOS },
  { id: "C02", familia: "C", texto: "Sozinho eu esqueço. Faz comigo?", contextos: TODOS },
  { id: "C03", familia: "C", texto: "Montei uma hive. Falta você.", contextos: TODOS },
  { id: "C04", familia: "C", texto: "Tô fazendo uns breaks de 3 min. Vem junto?", contextos: TODOS },
  { id: "C05", familia: "C", texto: "A hive tá esperando. Entra aí.", contextos: TODOS },
  { id: "C06", familia: "C", texto: "Me ajuda a não quebrar a sequência? Faz comigo.", contextos: TODOS },
  { id: "C07", familia: "C", texto: "Break das 15h. Cola com a gente?", contextos: TODOS },
  { id: "C08", familia: "C", texto: "Mais fácil em dupla. Topa ser minha dupla?", contextos: TODOS },
  { id: "C09", familia: "C", texto: "Ninguém vê sua câmera, só os números. Vem.", contextos: TODOS },
  { id: "C10", familia: "C", texto: "3 minutinhos juntos e cada um volta pro trabalho.", contextos: TODOS },
];

export const GANCHOS: Gancho[] = [...DESAFIO, ...BENEFICIO, ...COMPANHIA];

export function buscarGancho(id: string): Gancho | undefined {
  return GANCHOS.find((g) => g.id === id);
}

export function ganchosDaFamilia(familia: Familia): Gancho[] {
  return GANCHOS.filter((g) => g.familia === familia);
}

/** Prévia do link no WhatsApp por família (seção 3.2). */
export const OG_POR_FAMILIA: Record<Familia, { titulo: string; descricao: string }> = {
  D: { titulo: "{nome} te desafiou no Hive Break", descricao: "{exercicio}: {reps}. Leva 3 minutos, direto no navegador." },
  B: { titulo: "{nome} te chamou para um break de 3 min", descricao: "Mexa o corpo sem sair da sala. Direto no navegador." },
  C: { titulo: "{nome} quer fazer um break com você", descricao: "3 minutos juntos. Direto no navegador." },
};

/**
 * Hive ao vivo, resgate e hive completa (seções 3.3 a 3.5). Só dado por enquanto:
 * nenhuma tela nova usa isso ainda.
 */
export const TEXTOS_HIVE_AO_VIVO = {
  notificacao: "{nome} começou uma hive de {duracao} min. Entra?",
  salaAberta: "Hive aberta com {n} pessoas. Começa em {seg} s.",
  chamarNoWhatsapp: "Bora um break? Hive aberta agora: {link}",
};

export const TEXTOS_RESGATE = {
  paraQuemResgata: "{amigo} tá há 3 dias sem break. Chamar?",
  mensagens: [
    "Sentimos sua falta na hive. 3 minutinhos hoje?",
    "Bora voltar? Eu faço com você.",
    "Sua sequência pode recomeçar hoje. Vem comigo.",
  ],
};

export const TEXTOS_HIVE_COMPLETA = {
  paraQuemEstaNaHive: "Falta {nome} para o bônus de hive completa. Chamar para fazer agora?",
  mensagemEnviada: "Só falta você pra fechar o bônus da hive. Bora?",
};

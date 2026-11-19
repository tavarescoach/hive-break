/**
 * Regras do visitante no app (docs/VISITANTE.md). O banco decide o que vale
 * (liga, convite, lembretes); aqui fica para onde a pessoa vai e os textos.
 */

/** Seção 1.1: pedir o código antes de jogar. Padrão false (jogar antes converte mais). */
export function exigirEmailAntesDoDesafio(valor = process.env.EXIGIR_EMAIL_ANTES_DO_DESAFIO): boolean {
  return /^(1|true|sim|yes)$/i.test((valor ?? "").trim());
}

export interface EstadoVisitante {
  /** Já escolheu o username e marcou os aceites. */
  temUsername: boolean;
  /** Já fez a declaração de saúde. */
  fezDeclaracao: boolean;
  /** Já concluiu algum desafio. */
  desafiosConcluidos: number;
  /** Desafio para jogar agora (o do convite ou o primeiro liberado). */
  desafio: string | null;
}

/** Para onde levar um visitante que abre o app. */
export function destinoVisitante(estado: EstadoVisitante, exigirEmail = exigirEmailAntesDoDesafio()): string {
  if (!estado.temUsername || !estado.fezDeclaracao) return "/comecar";
  if (estado.desafiosConcluidos > 0 || exigirEmail) return "/salvar";
  return estado.desafio ? `/desafio/${estado.desafio}` : "/salvar";
}

/** "Seu resultado de ontem ainda não está salvo." (seção 2), pelo dia no fuso da pessoa. */
export function avisoResultadoNaoSalvo(ultimo: Date, agora: Date, fuso = "America/Sao_Paulo"): string {
  const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(d);
  const dias = Math.round((Date.parse(dia(agora)) - Date.parse(dia(ultimo))) / 86_400_000);
  if (dias <= 0) return "Seu resultado de hoje ainda não está salvo.";
  if (dias === 1) return "Seu resultado de ontem ainda não está salvo.";
  return `Seu resultado de ${dias} dias atrás ainda não está salvo.`;
}

/** Dias que faltam para o resultado não salvo ser apagado (a rotina apaga depois de 7). */
export function diasAteApagar(criadoEm: Date, agora: Date): number {
  return Math.max(0, 7 - Math.floor((agora.getTime() - criadoEm.getTime()) / 86_400_000));
}

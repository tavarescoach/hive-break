/**
 * Bloco "Meta da semana" (docs/PERFIL.md, seção 2.4). Lógica pura sobre o
 * retorno da função meta_semana() do banco: um array de 7 dias (segunda a
 * domingo) com quantas hives a pessoa fez em cada um.
 */

export interface DiaMeta {
  dia: string;
  hives: number;
}

export type EstadoDia = "cheia" | "meia" | "vazia";

/** Cheia = bateu a meta do dia; meia = treinou mas não bateu; vazia = não treinou. */
export function estadoDoDia(hives: number, metaHivesDia: number): EstadoDia {
  if (hives <= 0) return "vazia";
  if (hives >= metaHivesDia) return "cheia";
  return "meia";
}

export function diasComMetaBatida(dias: DiaMeta[], metaHivesDia: number): number {
  return dias.filter((d) => d.hives >= metaHivesDia).length;
}

export function semanaCompleta(dias: DiaMeta[], metaHivesDia: number, metaDiasSemana: number): boolean {
  return diasComMetaBatida(dias, metaHivesDia) >= metaDiasSemana;
}

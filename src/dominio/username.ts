/**
 * Username (docs/VISITANTE.md, seção 5). O formato é checado aqui, na hora,
 * enquanto a pessoa digita. Palavras proibidas, nomes reservados e
 * disponibilidade ficam no banco (username_motivo), que é quem decide.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
const FORMATO = /^[a-z0-9._]{3,20}$/;

export type MotivoUsername = "formato" | "reservado" | "proibido" | "em_uso" | "espera";

/** O que a pessoa digitou, do jeito que vai ser gravado (minúsculo, sem espaço nas pontas). */
export function normalizarUsername(bruto: string): string {
  return bruto.trim().toLowerCase();
}

/** Erro de formato, ou null se o formato está certo. */
export function erroDeFormato(bruto: string): string | null {
  const v = normalizarUsername(bruto);
  if (v.length < USERNAME_MIN) return `Use pelo menos ${USERNAME_MIN} caracteres.`;
  if (v.length > USERNAME_MAX) return `Use no máximo ${USERNAME_MAX} caracteres.`;
  if (/\s/.test(v)) return "Sem espaço. Use ponto ou sublinhado: joana.silva";
  if (!FORMATO.test(v)) return "Só letras sem acento, números, ponto e sublinhado.";
  return null;
}

export const MENSAGEM_MOTIVO: Record<MotivoUsername, string> = {
  formato: "Só letras sem acento, números, ponto e sublinhado, de 3 a 20.",
  reservado: "Esse nome é reservado. Tente outro.",
  proibido: "Esse nome não pode ser usado. Tente outro.",
  em_uso: "Esse já tem dono.",
  espera: "Você trocou o username há menos de 30 dias. Dá para trocar de novo depois.",
};

export function mensagemDoMotivo(motivo: string | null | undefined): string | null {
  return motivo && motivo in MENSAGEM_MOTIVO ? MENSAGEM_MOTIVO[motivo as MotivoUsername] : null;
}

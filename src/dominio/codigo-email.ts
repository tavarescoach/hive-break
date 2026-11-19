/**
 * Código de 6 dígitos por e-mail (docs/VISITANTE.md, seção 6).
 * O Supabase gera, manda e confere o código. O app guarda o intervalo de
 * reenvio e as tentativas erradas (funções codigo_* no banco).
 */
export const DIGITOS_CODIGO = 6;
export const REENVIO_S = 60;
/** Igual ao "Email OTP expiration" do painel do Supabase. */
export const VALIDADE_S = 600;
export const MAX_TENTATIVAS = 5;

/** Fluxos: visitante salvando o resultado, login de quem já tem conta, ou visitante entrando numa conta que já existe. */
export type FluxoCodigo = "conversao" | "login" | "migracao";

export function normalizarEmail(bruto: string): string {
  return bruto.trim().toLowerCase();
}

export function emailValido(bruto: string): boolean {
  const v = normalizarEmail(bruto);
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(v);
}

/** Tira tudo que não é dígito (colar "123 456" ou "Código: 123456") e corta em 6. */
export function soDigitos(bruto: string): string {
  return bruto.replace(/\D/g, "").slice(0, DIGITOS_CODIGO);
}

export function codigoCompleto(codigo: string): boolean {
  return new RegExp(`^\\d{${DIGITOS_CODIGO}}$`).test(codigo);
}

/** Tipo do verifyOtp: a conversão do visitante é uma troca de e-mail do usuário anônimo. */
export function tipoVerificacao(fluxo: FluxoCodigo): "email_change" | "email" {
  return fluxo === "conversao" ? "email_change" : "email";
}

export const MENSAGENS_CODIGO = {
  enviado: (email: string) => `Código enviado para ${email}. Confira também o spam.`,
  errado: (restantes: number) =>
    restantes === 1 ? "Código errado. Falta 1 tentativa." : `Código errado. Faltam ${restantes} tentativas.`,
  expirado: "Código expirado. Mandar outro?",
  bloqueado: "Você errou o código 5 vezes. Peça um código novo.",
  espera: (s: number) => `Para mandar outro, espere ${s} s.`,
  emailInvalido: "Confira o e-mail. Ex.: nome@gmail.com",
  falha: "Não consegui mandar o código agora. Confira a internet e tente de novo.",
  limite: "Muitos códigos pedidos em pouco tempo. Tente de novo em alguns minutos.",
  captcha: "Não consegui confirmar que você é uma pessoa. Recarregue a página e tente de novo.",
} as const;

export type ResultadoErroCodigo = { tipo: "errado"; restantes: number } | { tipo: "expirado" } | { tipo: "bloqueado" };

/**
 * O Supabase responde "expirado ou inválido" tanto para o código errado quanto
 * para o vencido. A idade do envio separa os dois casos; as tentativas que
 * restam (já descontado este erro) dizem se bloqueou.
 */
export function classificarErroCodigo(restantesDepois: number, enviadoHaS: number | null): ResultadoErroCodigo {
  if (enviadoHaS !== null && enviadoHaS >= VALIDADE_S) return { tipo: "expirado" };
  if (restantesDepois <= 0) return { tipo: "bloqueado" };
  return { tipo: "errado", restantes: restantesDepois };
}

export function mensagemErroCodigo(erro: ResultadoErroCodigo): string {
  if (erro.tipo === "expirado") return MENSAGENS_CODIGO.expirado;
  if (erro.tipo === "bloqueado") return MENSAGENS_CODIGO.bloqueado;
  return MENSAGENS_CODIGO.errado(erro.restantes);
}

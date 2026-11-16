/** Cookie que guarda o código de convite entre a landing /c/[codigo] e o login. */
export const COOKIE_CONVITE = "hb_convite";
export const CODIGO_VALIDO = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizarCodigo(bruto: string): string | null {
  const codigo = bruto.trim().toUpperCase();
  return CODIGO_VALIDO.test(codigo) ? codigo : null;
}

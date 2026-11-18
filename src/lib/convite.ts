import type { Familia } from "@/conteudo/ganchos";

/** Cookie que guarda o código de convite entre a landing /c/[codigo] e o login. */
export const COOKIE_CONVITE = "hb_convite";
/** Cookie que guarda qual gancho (família + id) trouxe a pessoa, para o funil da seção 4. */
export const COOKIE_GANCHO = "hb_gancho";
export const CODIGO_VALIDO = /^[A-HJ-NP-Z2-9]{6}$/;
const FAMILIA_VALIDA = /^[DBC]$/;
const GANCHO_ID_VALIDO = /^[DBC]\d{2}$/;
const GANCHO_COOKIE_VALIDO = /^([DBC]):([DBC]\d{2})$/;

export function normalizarCodigo(bruto: string): string | null {
  const codigo = bruto.trim().toUpperCase();
  return CODIGO_VALIDO.test(codigo) ? codigo : null;
}

export function familiaDaQuery(valor: string | null | undefined): Familia | null {
  return valor && FAMILIA_VALIDA.test(valor) ? (valor as Familia) : null;
}

export function ganchoIdDaQuery(valor: string | null | undefined): string | null {
  return valor && GANCHO_ID_VALIDO.test(valor) ? valor : null;
}

/** "D:D04" para guardar no cookie entre a landing e o login. */
export function serializarGancho(familia: Familia, ganchoId: string): string {
  return `${familia}:${ganchoId}`;
}

export function normalizarGanchoCookie(bruto: string | undefined | null): { familia: Familia; ganchoId: string } | null {
  const m = bruto ? GANCHO_COOKIE_VALIDO.exec(bruto.trim()) : null;
  return m ? { familia: m[1] as Familia, ganchoId: m[2] } : null;
}

/** Link de convite com o gancho usado, para o funil da seção 4 (`?g=&h=&ref=`). */
export function montarLinkConvite(origem: string, codigo: string, gancho?: { familia: Familia; id: string } | null): string {
  const url = new URL(`/c/${codigo}`, origem);
  if (gancho) {
    url.searchParams.set("g", gancho.familia);
    url.searchParams.set("h", gancho.id);
  }
  url.searchParams.set("ref", codigo);
  return url.toString();
}

/** Busca de amigos (docs/PERFIL.md, seção 4). */

export const BUSCA_MIN_CARACTERES = 2;
export const BUSCA_DEBOUNCE_MS = 300;

export interface ResultadoBusca {
  id: string;
  apelido: string | null;
  username: string;
  avatar_url: string | null;
  divisao_atual: string;
  objetivo: string | null;
  ofensiva: number;
  amigos_em_comum: number;
  seguindo: boolean;
  segue_voce: boolean;
}

export type EstadoSeguir = "seguir" | "seguindo" | "seguir_de_volta";

export function estadoSeguir(r: { seguindo: boolean; segue_voce: boolean }): EstadoSeguir {
  if (r.seguindo) return "seguindo";
  if (r.segue_voce) return "seguir_de_volta";
  return "seguir";
}

export const ROTULO_SEGUIR: Record<EstadoSeguir, string> = {
  seguir: "Seguir",
  seguindo: "Seguindo",
  seguir_de_volta: "Seguir de volta",
};

/** Vitrine e "próxima conquista mais perto" (docs/PERFIL.md, seção 3.2). */

export interface ProgressoConquista {
  id: string;
  nome: string;
  descricao: string;
  conquistada: boolean;
  conquistada_em: string | null;
  atual: number | null;
  meta: number | null;
}

function fracao(c: ProgressoConquista): number {
  if (c.atual == null || c.meta == null || c.meta <= 0) return 0;
  return Math.min(1, c.atual / c.meta);
}

/** Entre as não conquistadas com progresso mensurável, a que está mais perto de bater a meta. */
export function proximaConquista(lista: ProgressoConquista[]): ProgressoConquista | null {
  const candidatas = lista.filter((c) => !c.conquistada && c.atual != null && c.meta != null && c.meta > 0);
  if (candidatas.length === 0) return null;
  return candidatas.reduce((melhor, atual) => (fracao(atual) > fracao(melhor) ? atual : melhor));
}

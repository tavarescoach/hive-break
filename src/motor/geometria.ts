export interface Vetor {
  x: number;
  y: number;
  z: number;
}

export function vetor(x: number, y: number, z = 0): Vetor {
  return { x, y, z };
}

export function distancia(a: Vetor, b: Vetor): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function pontoMedio(a: Vetor, b: Vetor): Vetor {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/**
 * Ângulo no ponto `b` formado pelos segmentos b→a e b→c, em graus.
 * 180 = segmento reto. Retorna NaN se algum segmento tiver comprimento zero.
 */
export function angulo(a: Vetor, b: Vetor, c: Vetor): number {
  const ux = a.x - b.x;
  const uy = a.y - b.y;
  const uz = a.z - b.z;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const vz = c.z - b.z;
  const nu = Math.hypot(ux, uy, uz);
  const nv = Math.hypot(vx, vy, vz);
  if (nu < 1e-9 || nv < 1e-9) return NaN;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (nu * nv)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}

export function media(valores: number[]): number {
  if (valores.length === 0) return NaN;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export function desvioPadrao(valores: number[]): number {
  if (valores.length < 2) return 0;
  const m = media(valores);
  return Math.sqrt(valores.reduce((s, v) => s + (v - m) ** 2, 0) / valores.length);
}

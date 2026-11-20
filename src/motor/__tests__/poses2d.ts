/**
 * Poses montadas ponto a ponto em 2D para testar exercícios que o boneco de
 * `sintetico.ts` não faz (de lado, sentado, meio corpo). Coordenadas "quadradas":
 * x já multiplicado pela proporção da imagem.
 */
import { INDICE_PONTO, TOTAL_PONTOS } from "../pontos";
import type { Frame, Ponto } from "../tipos";
import { PROPORCAO } from "./sintetico";

export type XY = [number, number];
export type Pose = Record<string, XY>;

export const rad = (g: number) => (g * Math.PI) / 180;
export const soma = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];
/** Vetor de comprimento `l` que faz `graus` com a vertical para baixo (0 = para baixo, 180 = para cima), girando para a direita. */
export const dir = (graus: number, l: number): XY => [l * Math.sin(rad(graus)), l * Math.cos(rad(graus))];

/** Frame com os pontos dados (em coordenadas "quadradas": x já multiplicado pela proporção). Os demais ficam no centro. */
export function frame(t: number, pose: Pose, visibilidade = 0.95): Frame {
  const base: Ponto[] = Array.from({ length: TOTAL_PONTOS }, () => ({ x: 0.5, y: 0.5, visibility: visibilidade }));
  for (const [nome, [x, y]] of Object.entries(pose)) base[INDICE_PONTO[nome]] = { x: x / PROPORCAO, y, visibility: visibilidade };
  const mundo = base.map((p) => ({ x: p.x * PROPORCAO, y: p.y, z: 0 }));
  return { t, pontos: base, mundo };
}

/** Roteiro de valores: [valor, segundos até chegar nele]. Interpola linearmente a 30 fps. */
export function roteiro(montar: (v: number) => Pose, passos: [number, number][], inicio = 0): Frame[] {
  const frames: Frame[] = [];
  let t = inicio;
  let atual = passos[0][0];
  for (const [alvo, s] of passos) {
    const n = Math.max(1, Math.round(s * 30));
    for (let i = 1; i <= n; i++) {
      t += 1000 / 30;
      frames.push(frame(t, montar(atual + ((alvo - atual) * i) / n)));
    }
    atual = alvo;
  }
  return frames;
}

/** Ambos os lados iguais (vistos de lado, um em cima do outro). */
export const ambos = (p: Record<string, XY>): Pose =>
  Object.fromEntries(Object.entries(p).flatMap(([n, v]) => [[`${n}_e`, v], [`${n}_d`, v]]));

import { LIGACOES, PONTOS_DESENHADOS } from "@/motor/pontos";
import type { Ponto } from "@/motor/tipos";

export interface EstiloEsqueleto {
  /** Pontos obrigatórios visíveis: esqueleto na cor da marca. Senão, cinza. */
  valido: boolean;
  /** Há erro de execução agora: os pontos ficam vermelhos. */
  erro: boolean;
  visibilidadeMinima?: number;
  /** Cor do esqueleto quando válido (padrão: amarelo da marca). */
  cor?: string;
}

const COR_OK = "#FFC42E";
const COR_APAGADO = "rgba(255,255,255,0.45)";
const COR_ERRO = "#FF4D4D";

/** Desenha o esqueleto no canvas (mesmo tamanho do vídeo). O espelhamento é feito por CSS. */
export function desenharEsqueleto(ctx: CanvasRenderingContext2D, pontos: Ponto[] | null, estilo: EstiloEsqueleto): void {
  const { width: largura, height: altura } = ctx.canvas;
  ctx.clearRect(0, 0, largura, altura);
  if (!pontos) return;

  const minimo = estilo.visibilidadeMinima ?? 0.6;
  const visivel = (i: number) => (pontos[i].visibility ?? 1) >= minimo;
  const base = Math.max(2, Math.round(Math.min(largura, altura) / 110));

  ctx.lineCap = "round";
  ctx.lineWidth = base * 1.6;
  for (const [a, b] of LIGACOES) {
    const ok = visivel(a) && visivel(b);
    ctx.strokeStyle = ok && estilo.valido ? (estilo.cor ?? COR_OK) : COR_APAGADO;
    ctx.beginPath();
    ctx.moveTo(pontos[a].x * largura, pontos[a].y * altura);
    ctx.lineTo(pontos[b].x * largura, pontos[b].y * altura);
    ctx.stroke();
  }

  for (const i of PONTOS_DESENHADOS) {
    ctx.fillStyle = estilo.erro ? COR_ERRO : visivel(i) ? "#FFFFFF" : COR_APAGADO;
    ctx.beginPath();
    ctx.arc(pontos[i].x * largura, pontos[i].y * altura, base * (estilo.erro ? 2.2 : 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Desenha o alvo do exercício "Toque nos alvos" (coordenadas de 0 a 1; raio em fração da altura). */
export function desenharAlvo(ctx: CanvasRenderingContext2D, alvo: { x: number; y: number; raio: number }): void {
  const { width: largura, height: altura } = ctx.canvas;
  const x = alvo.x * largura;
  const y = alvo.y * altura;
  const raio = alvo.raio * altura;
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 196, 46, 0.35)";
  ctx.fill();
  ctx.lineWidth = Math.max(4, raio * 0.14);
  ctx.strokeStyle = COR_OK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, raio * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = COR_OK;
  ctx.fill();
}

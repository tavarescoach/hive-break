/**
 * Desenho do card de compartilhamento num <canvas>, no próprio celular.
 * A foto de fundo (selfie ou galeria) só passa pelo canvas: nada é enviado.
 *
 * Cores e fonte seguem os tokens de src/app/globals.css.
 */

import type { DadosCard } from "@/dominio/card";

export type Formato = "9:16" | "4:5";

export const TAMANHOS: Record<Formato, { largura: number; altura: number }> = {
  "9:16": { largura: 1080, altura: 1920 },
  "4:5": { largura: 1080, altura: 1350 },
};

export const COR = {
  fundo: "#0d0e11",
  superficie: "#17191e",
  texto: "#f5f2ea",
  apagado: "#a3a6ae",
  mel: "#ffc42e",
  melForte: "#f5a800",
} as const;

/** Mesma pilha de --font-sans. Trocar aqui se a marca adotar uma fonte própria. */
export const FONTE = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const PESOS = [600, 700, 900];

/** Carrega a fonte em todos os pesos usados antes de desenhar (senão o 1º desenho sai com a fonte errada). */
export async function carregarFontes(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all(PESOS.map((p) => document.fonts.load(`${p} 48px ${FONTE}`, "0123456789 Seu recorde ÁÇÉ@·")));
    await document.fonts.ready;
  } catch {
    // Sem a API, o navegador usa a fonte do sistema do mesmo jeito.
  }
}

export type Fundo =
  | { tipo: "hive" }
  | { tipo: "foto"; imagem: CanvasImageSource; largura: number; altura: number };

export interface Toggles {
  recorde: boolean;
  hive: boolean;
  pse: boolean;
}

type Ctx = CanvasRenderingContext2D;

const fonte = (peso: number, px: number) => `${peso} ${Math.round(px)}px ${FONTE}`;

function espacamento(ctx: Ctx, px: number) {
  if ("letterSpacing" in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

/** Corta o texto com reticências para caber na largura. */
function caber(ctx: Ctx, texto: string, max: number): string {
  if (ctx.measureText(texto).width <= max) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Reduz a fonte até o texto caber (até um mínimo), depois corta. */
function fonteQueCabe(ctx: Ctx, texto: string, peso: number, px: number, max: number, minimo = px * 0.6): number {
  let tamanho = px;
  ctx.font = fonte(peso, tamanho);
  while (tamanho > minimo && ctx.measureText(texto).width > max) {
    tamanho -= 2;
    ctx.font = fonte(peso, tamanho);
  }
  return tamanho;
}

function retanguloArredondado(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexagono(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ============================================================== fundo

/** Arte da hive: favo de mel em linhas finas com algumas células acesas. */
export function desenharArteHive(ctx: Ctx, w: number, h: number) {
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, w, h);

  const brilho = ctx.createRadialGradient(w * 0.85, h * 0.12, 0, w * 0.85, h * 0.12, w * 1.1);
  brilho.addColorStop(0, "rgba(255,196,46,0.30)");
  brilho.addColorStop(0.45, "rgba(245,168,0,0.08)");
  brilho.addColorStop(1, "rgba(13,14,17,0)");
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 0, w, h);

  const r = 78;
  const dx = Math.sqrt(3) * r;
  const dy = 1.5 * r;
  let semente = 7;
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647;
    return semente / 2147483647;
  };
  for (let linha = -1; linha * dy < h + r; linha++) {
    for (let col = -1; col * dx < w + dx; col++) {
      const cx = col * dx + (linha % 2 ? dx / 2 : 0);
      const cy = linha * dy;
      // Mais forte no alto, some na parte de baixo, onde ficam os dados.
      const peso = Math.max(0, 1 - cy / (h * 0.75));
      const sorte = aleatorio();
      hexagono(ctx, cx, cy, r - 6);
      if (sorte > 0.86 && peso > 0.15) {
        ctx.fillStyle = `rgba(255,196,46,${(0.10 + 0.35 * sorte * peso).toFixed(3)})`;
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(255,196,46,${(0.05 + 0.16 * peso).toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function desenharFoto(ctx: Ctx, fundo: Extract<Fundo, { tipo: "foto" }>, w: number, h: number) {
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, w, h);
  // "cover": preenche o card inteiro, cortando o que sobrar.
  const escala = Math.max(w / fundo.largura, h / fundo.altura);
  const lw = fundo.largura * escala;
  const lh = fundo.altura * escala;
  ctx.drawImage(fundo.imagem, (w - lw) / 2, (h - lh) / 2, lw, lh);

  const topo = ctx.createLinearGradient(0, 0, 0, 300);
  topo.addColorStop(0, "rgba(13,14,17,0.65)");
  topo.addColorStop(1, "rgba(13,14,17,0)");
  ctx.fillStyle = topo;
  ctx.fillRect(0, 0, w, 300);

  const base = ctx.createLinearGradient(0, h * 0.35, 0, h);
  base.addColorStop(0, "rgba(13,14,17,0)");
  base.addColorStop(0.55, "rgba(13,14,17,0.6)");
  base.addColorStop(1, "rgba(13,14,17,0.9)");
  ctx.fillStyle = base;
  ctx.fillRect(0, h * 0.35, w, h * 0.65);
}

// ============================================================== conteúdo

/** Cada seção desenha (ou só mede, com desenhar = false) e devolve a altura usada. */
type Secao = (ctx: Ctx, x: number, y: number, w: number, s: number, desenhar: boolean) => number;

function marca(ctx: Ctx, x: number, y: number, s: number, desenhar: boolean): number {
  const r = 22 * s;
  if (desenhar) {
    hexagono(ctx, x + r, y + r, r);
    ctx.fillStyle = COR.mel;
    ctx.fill();
    hexagono(ctx, x + r, y + r, r * 0.45);
    ctx.fillStyle = COR.fundo;
    ctx.fill();
    ctx.font = fonte(900, 34 * s);
    espacamento(ctx, 4 * s);
    ctx.fillStyle = COR.texto;
    ctx.textBaseline = "middle";
    ctx.fillText("HIVE BREAK", x + r * 2 + 16 * s, y + r + 1);
    espacamento(ctx, 0);
  }
  return r * 2;
}

function secaoOfensiva(d: DadosCard): Secao {
  return (ctx, x, y, w, s, desenhar) => {
    const sobre = 30 * s;
    const numeroPx = 260 * s;
    ctx.textBaseline = "alphabetic";
    if (desenhar) {
      ctx.font = fonte(900, sobre);
      espacamento(ctx, 6 * s);
      ctx.fillStyle = COR.mel;
      ctx.fillText("SEQUÊNCIA", x, y + sobre);
      espacamento(ctx, 0);
    }
    const topoNumero = y + sobre + 16 * s;
    const numero = String(d.ofensiva);
    ctx.font = fonte(900, numeroPx);
    espacamento(ctx, -8 * s);
    const larguraNumero = ctx.measureText(numero).width;
    const baseNumero = topoNumero + numeroPx * 0.74;
    if (desenhar) {
      ctx.fillStyle = COR.mel;
      ctx.fillText(numero, x - 6 * s, baseNumero);
    }
    espacamento(ctx, 0);
    if (desenhar) {
      const xr = x + larguraNumero + 28 * s;
      const livre = w - (xr - x);
      ctx.fillStyle = COR.texto;
      fonteQueCabe(ctx, d.rotuloOfensiva, 900, 64 * s, livre);
      ctx.fillText(caber(ctx, d.rotuloOfensiva, livre), xr, baseNumero - 64 * s);
      ctx.fillStyle = COR.texto;
      ctx.globalAlpha = 0.82;
      fonteQueCabe(ctx, d.fraseOfensiva, 700, 44 * s, livre);
      ctx.fillText(caber(ctx, d.fraseOfensiva, livre), xr, baseNumero);
      ctx.globalAlpha = 1;
    }
    return baseNumero - y;
  };
}

function secaoBlocos(d: DadosCard): Secao {
  return (ctx, x, y, w, s, desenhar) => {
    const n = d.blocos.length;
    if (n === 0) return 0;
    const colunas = n === 1 ? 1 : n === 2 || n === 4 ? 2 : 3;
    const linhas = Math.ceil(n / colunas);
    const gap = 20 * s;
    const pad = 28 * s;
    const valorPx = (colunas === 1 ? 150 : colunas === 2 ? 124 : 100) * s;
    let lw = (w - gap * (colunas - 1)) / colunas;
    if (colunas === 1) {
      // Um exercício só: o painel abraça o conteúdo em vez de ocupar a linha toda.
      const b = d.blocos[0];
      const medidas: number[] = [];
      ctx.font = fonte(700, 32 * s);
      medidas.push(ctx.measureText(b.exercicio).width);
      ctx.font = fonte(900, valorPx);
      medidas.push(ctx.measureText(b.valor).width);
      ctx.font = fonte(600, 30 * s);
      medidas.push(ctx.measureText(b.series).width);
      lw = Math.min(w, Math.max(w * 0.55, Math.max(...medidas) + pad * 2 + 8 * s));
    }
    const temSeries = d.blocos.some((b) => b.series);
    const altura = pad + 34 * s + 14 * s + valorPx * 0.74 + 16 * s + 32 * s + (temSeries ? 14 * s + 30 * s : 0) + pad;
    if (desenhar) {
      d.blocos.forEach((b, i) => {
        const bx = x + (i % colunas) * (lw + gap);
        const by = y + Math.floor(i / colunas) * (altura + gap);
        retanguloArredondado(ctx, bx, by, lw, altura, 28 * s);
        ctx.fillStyle = "rgba(23,25,30,0.82)";
        ctx.fill();
        ctx.strokeStyle = "rgba(245,242,234,0.12)";
        ctx.lineWidth = 2;
        ctx.stroke();

        const cx = bx + pad;
        const largura = lw - pad * 2;
        let cy = by + pad + 34 * s;
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = COR.apagado;
        ctx.font = fonte(700, 32 * s);
        ctx.fillText(caber(ctx, b.exercicio, largura), cx, cy - 6 * s);
        cy += 14 * s + valorPx * 0.74;
        ctx.fillStyle = COR.texto;
        fonteQueCabe(ctx, b.valor, 900, valorPx, largura);
        espacamento(ctx, -3 * s);
        ctx.fillText(b.valor, cx - 3 * s, cy);
        espacamento(ctx, 0);
        cy += 16 * s + 32 * s;
        ctx.fillStyle = COR.mel;
        fonteQueCabe(ctx, b.unidade.toUpperCase(), 900, 30 * s, largura, 20 * s);
        ctx.fillText(caber(ctx, b.unidade.toUpperCase(), largura), cx, cy - 4 * s);
        if (b.series) {
          cy += 14 * s + 30 * s;
          ctx.fillStyle = COR.texto;
          ctx.globalAlpha = 0.72;
          fonteQueCabe(ctx, b.series, 600, 30 * s, largura, 18 * s);
          ctx.fillText(caber(ctx, b.series, largura), cx, cy - 4 * s);
          ctx.globalAlpha = 1;
        }
      });
    }
    return linhas * altura + (linhas - 1) * gap;
  };
}

interface Pilula {
  destaque?: string;
  texto: string;
}

function pilulasDosExtras(d: DadosCard, t: Toggles): Pilula[] {
  const p: Pilula[] = [];
  if (t.recorde && d.recorde) p.push({ destaque: d.recorde.novo ? "Novo recorde" : undefined, texto: d.recorde.texto });
  if (t.hive && d.hive) p.push({ texto: d.hive });
  if (t.pse && d.pse) p.push({ texto: d.pse });
  return p;
}

function secaoExtras(pilulas: Pilula[]): Secao {
  return (ctx, x, y, w, s, desenhar) => {
    if (pilulas.length === 0) return 0;
    const h = 64 * s;
    const gap = 14 * s;
    const pad = 26 * s;
    let cx = x;
    let cy = y;
    for (const p of pilulas) {
      ctx.font = fonte(900, 30 * s);
      const ld = p.destaque ? ctx.measureText(p.destaque.toUpperCase()).width + 28 * s : 0;
      ctx.font = fonte(700, 32 * s);
      const max = w - pad * 2 - (ld ? ld + 14 * s : 0);
      const texto = caber(ctx, p.texto, max);
      const largura = pad * 2 + (ld ? ld + 14 * s : 0) + ctx.measureText(texto).width;
      if (cx > x && cx + largura > x + w) {
        cx = x;
        cy += h + gap;
      }
      if (desenhar) {
        retanguloArredondado(ctx, cx, cy, largura, h, h / 2);
        ctx.fillStyle = "rgba(23,25,30,0.82)";
        ctx.fill();
        ctx.strokeStyle = p.destaque ? COR.mel : "rgba(245,242,234,0.16)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.textBaseline = "middle";
        let tx = cx + pad;
        if (p.destaque) {
          const dh = 42 * s;
          retanguloArredondado(ctx, tx - 10 * s, cy + (h - dh) / 2, ld, dh, dh / 2);
          ctx.fillStyle = COR.mel;
          ctx.fill();
          ctx.fillStyle = "#000";
          ctx.font = fonte(900, 26 * s);
          ctx.fillText(p.destaque.toUpperCase(), tx + 4 * s, cy + h / 2 + 1);
          tx += ld + 4 * s;
        }
        ctx.fillStyle = COR.texto;
        ctx.font = fonte(700, 32 * s);
        ctx.fillText(texto, tx, cy + h / 2 + 1);
        ctx.textBaseline = "alphabetic";
      }
      cx += largura + gap;
    }
    return cy + h - y;
  };
}

function secaoIdentificacao(d: DadosCard, comData: boolean): Secao {
  return (ctx, x, y, w, s, desenhar) => {
    const l1 = 44 * s;
    const l2 = 32 * s;
    const quem = [d.usuario, d.instagram].filter(Boolean).join("  ·  ");
    const oque = [d.desafio, d.modalidade !== d.desafio ? d.modalidade : null].filter(Boolean).join(" · ");
    let h = l1 + 14 * s + l2;
    if (comData) h += 10 * s + l2;
    if (desenhar) {
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = COR.texto;
      ctx.font = fonte(900, l1);
      ctx.fillText(caber(ctx, quem, w), x, y + l1 * 0.8);
      ctx.fillStyle = COR.texto;
      ctx.globalAlpha = 0.75;
      ctx.font = fonte(700, l2);
      ctx.fillText(caber(ctx, oque, w), x, y + l1 + 14 * s + l2 * 0.8);
      if (comData) ctx.fillText(d.quando, x, y + l1 + 14 * s + l2 + 10 * s + l2 * 0.8);
      ctx.globalAlpha = 1;
    }
    return h;
  };
}

/** Empilha as seções com espaçamento e devolve a altura total. */
function empilhar(ctx: Ctx, secoes: Secao[], x: number, y: number, w: number, s: number, desenhar: boolean): number {
  const gap = 44 * s;
  let cy = y;
  let primeira = true;
  for (const secao of secoes) {
    const h = secao(ctx, x, cy + (primeira ? 0 : gap), w, s, false);
    if (h === 0) continue;
    if (!primeira) cy += gap;
    if (desenhar) secao(ctx, x, cy, w, s, true);
    cy += h;
    primeira = false;
  }
  return cy - y;
}

// ============================================================== cards

/** Card com fundo, no formato escolhido. */
export function desenharCard(canvas: HTMLCanvasElement, d: DadosCard, formato: Formato, fundo: Fundo, toggles: Toggles) {
  const { largura: w, altura: h } = TAMANHOS[formato];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (fundo.tipo === "foto") desenharFoto(ctx, fundo, w, h);
  else desenharArteHive(ctx, w, h);

  const m = 72;
  // Topo: marca à esquerda, data e hora à direita.
  const topo = formato === "9:16" ? 96 : 64;
  marca(ctx, m, topo, 1, true);
  ctx.font = fonte(700, 30);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COR.texto;
  ctx.fillText(d.quando, w - m, topo + 23);
  ctx.textAlign = "left";

  const secoes = [secaoOfensiva(d), secaoBlocos(d), secaoExtras(pilulasDosExtras(d, toggles)), secaoIdentificacao(d, false)];
  const base = formato === "9:16" ? 140 : 72;
  const disponivel = h - base - (topo + 44 + 56);
  if (fundo.tipo === "foto") {
    // Foto clara: sombra leve para o texto fora dos painéis continuar legível.
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 2;
  }
  const natural = empilhar(ctx, secoes, m, 0, w - 2 * m, 1, false);
  // Muitos exercícios no 4:5: encolhe tudo por igual em vez de cortar.
  const s = Math.max(0.55, Math.min(1, disponivel / natural));
  const altura = empilhar(ctx, secoes, m, 0, w - 2 * m, s, false);
  empilhar(ctx, secoes, m, h - base - altura, w - 2 * m, s, true);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

/** Adesivo: PNG transparente só com os dados, recortado na altura do conteúdo. */
export function desenharAdesivo(canvas: HTMLCanvasElement, d: DadosCard, toggles: Toggles) {
  const w = 1080;
  const m = 40;
  const pad = 56;
  const largura = w - 2 * m - 2 * pad;
  const medidor = document.createElement("canvas").getContext("2d");
  if (!medidor) return;
  const secoes = [secaoOfensiva(d), secaoBlocos(d), secaoExtras(pilulasDosExtras(d, toggles)), secaoIdentificacao(d, true)];
  const cabecalho = 44 + 40;
  const conteudo = empilhar(medidor, secoes, 0, 0, largura, 1, false);
  const h = m * 2 + pad * 2 + cabecalho + conteudo;
  canvas.width = w;
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  retanguloArredondado(ctx, m, m, w - 2 * m, h - 2 * m, 48);
  ctx.fillStyle = "rgba(13,14,17,0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,196,46,0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
  marca(ctx, m + pad, m + pad, 1, true);
  empilhar(ctx, secoes, m + pad, m + pad + cabecalho, largura, 1, true);
}

export function paraPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))), "image/png"));
}

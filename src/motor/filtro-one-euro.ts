/**
 * Filtro One Euro (Casiez, Roussel e Vogel, 2012): suaviza tremor quando o
 * ponto está quase parado e acompanha o movimento rápido com pouco atraso.
 */
export interface OpcoesOneEuro {
  /** Corte mínimo em Hz: menor = mais suave quando parado. */
  corteMinimo?: number;
  /** Quanto o corte sobe com a velocidade: maior = menos atraso em movimento. */
  beta?: number;
  /** Corte da derivada em Hz. */
  corteDerivada?: number;
}

function alfa(corte: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * corte);
  return 1 / (1 + tau / dt);
}

export class FiltroOneEuro {
  private readonly corteMinimo: number;
  private readonly beta: number;
  private readonly corteDerivada: number;
  private xAnterior: number | null = null;
  private dxAnterior = 0;
  private tAnterior = 0;

  constructor(opcoes: OpcoesOneEuro = {}) {
    this.corteMinimo = opcoes.corteMinimo ?? 2;
    this.beta = opcoes.beta ?? 10;
    this.corteDerivada = opcoes.corteDerivada ?? 1;
  }

  /** `t` em milissegundos. */
  filtrar(x: number, t: number): number {
    if (this.xAnterior === null) {
      this.xAnterior = x;
      this.tAnterior = t;
      return x;
    }
    const dt = (t - this.tAnterior) / 1000;
    if (dt <= 0) return this.xAnterior;
    // Depois de um buraco longo (pessoa saiu do quadro), recomeça do zero.
    if (dt > 0.5) {
      this.xAnterior = x;
      this.dxAnterior = 0;
      this.tAnterior = t;
      return x;
    }
    const dx = (x - this.xAnterior) / dt;
    const dxSuave = this.dxAnterior + alfa(this.corteDerivada, dt) * (dx - this.dxAnterior);
    const corte = this.corteMinimo + this.beta * Math.abs(dxSuave);
    const xSuave = this.xAnterior + alfa(corte, dt) * (x - this.xAnterior);
    this.xAnterior = xSuave;
    this.dxAnterior = dxSuave;
    this.tAnterior = t;
    return xSuave;
  }

  reiniciar(): void {
    this.xAnterior = null;
    this.dxAnterior = 0;
  }
}

/** Um filtro por coordenada de cada ponto. */
export class FiltroPose {
  private filtros: FiltroOneEuro[] = [];

  constructor(
    private readonly totalPontos: number,
    private readonly opcoes: OpcoesOneEuro = {},
  ) {
    for (let i = 0; i < totalPontos * 3; i++) this.filtros.push(new FiltroOneEuro(opcoes));
  }

  filtrar<T extends { x: number; y: number; z?: number }>(pontos: T[], t: number): T[] {
    return pontos.map((p, i) => ({
      ...p,
      x: this.filtros[i * 3].filtrar(p.x, t),
      y: this.filtros[i * 3 + 1].filtrar(p.y, t),
      z: p.z === undefined ? undefined : this.filtros[i * 3 + 2].filtrar(p.z, t),
    }));
  }

  reiniciar(): void {
    for (const f of this.filtros) f.reiniciar();
  }
}

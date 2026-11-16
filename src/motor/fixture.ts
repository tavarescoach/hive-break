import type { Frame, Ponto } from "./tipos";

/**
 * Formato de uma sequência de landmarks gravada (fixture). É o mesmo formato
 * que o gravador da página de teste técnico baixa no aparelho.
 */
export interface Fixture {
  versao: 1;
  exercicio: string;
  origem: "sintetica" | "gravada";
  descricao?: string;
  /** Largura dividida pela altura do vídeo. */
  proporcao: number;
  fps?: number;
  modelo?: string;
  /** Resultado esperado, usado pelos testes (contagem manual nas gravações reais). */
  esperado?: {
    reps_validas?: number;
    reps_parciais?: number;
    tempo_valido_s?: number;
    /** Erro aceito na contagem (padrão: 1 a cada 10 reps, 2 s a cada 60 s). */
    tolerancia?: number;
  };
  frames: FrameFixture[];
}

/** t em ms; p = [x, y, visibilidade] na imagem; m = [x, y, z] em metros. */
export interface FrameFixture {
  t: number;
  p: [number, number, number][] | null;
  m?: [number, number, number][] | null;
}

const arredondar = (v: number, casas: number) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

export function serializarFrame(frame: Frame): FrameFixture {
  return {
    t: Math.round(frame.t),
    p: frame.pontos
      ? frame.pontos.map((p) => [arredondar(p.x, 4), arredondar(p.y, 4), arredondar(p.visibility ?? 1, 2)])
      : null,
    m: frame.mundo ? frame.mundo.map((p) => [arredondar(p.x, 3), arredondar(p.y, 3), arredondar(p.z ?? 0, 3)]) : null,
  };
}

export function framesDaFixture(fixture: Fixture): Frame[] {
  return fixture.frames.map((f) => ({
    t: f.t,
    pontos: f.p ? f.p.map(([x, y, visibility]): Ponto => ({ x, y, visibility })) : null,
    mundo: f.m ? f.m.map(([x, y, z]): Ponto => ({ x, y, z })) : null,
  }));
}

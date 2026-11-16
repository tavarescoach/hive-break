import type { Delegado, ModeloPose } from "@/camera/pose";
import type { FrameFixture } from "@/motor/fixture";
import type { DefinicaoExercicio, Kpis } from "@/motor/tipos";

export interface ConfigTeste {
  def: DefinicaoExercicio;
  /** Repetições ou segundos. 0 = livre (conta até a pessoa encerrar). */
  meta: number;
  modelo: ModeloPose;
  /** Guardar os landmarks desta tentativa para baixar depois (só no aparelho). */
  gravar: boolean;
}

export interface ResultadoTeste {
  config: ConfigTeste;
  unidade: "reps" | "s";
  /** Reps válidas ou segundos válidos contados pelo motor. */
  contagem: number;
  kpis: Kpis;
  fpsMedio: number;
  delegado: Delegado;
  proporcao: number;
  gravacao: FrameFixture[] | null;
  /** A gravação bateu no limite de tempo e foi cortada. */
  gravacaoCortada: boolean;
}

export const ehSustentacao = (def: DefinicaoExercicio) => def.formato !== "repeticoes";

export function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

import type { DefinicaoExercicio } from "@/motor/tipos";
import agachamento from "./agachamento_livre.json";
import apoio from "./apoio_uma_perna.json";
import polichinelo from "./polichinelo.json";

/** Exercícios da Fase 0. Cada um é só um arquivo de dados lido pelo motor. */
export const EXERCICIOS: DefinicaoExercicio[] = [
  agachamento as unknown as DefinicaoExercicio,
  polichinelo as unknown as DefinicaoExercicio,
  apoio as unknown as DefinicaoExercicio,
];

export function exercicioPorId(id: string): DefinicaoExercicio | undefined {
  return EXERCICIOS.find((e) => e.id === id);
}

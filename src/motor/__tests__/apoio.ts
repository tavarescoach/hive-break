import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { exercicioPorId } from "@/exercicios";
import { framesDaFixture, type Fixture } from "../fixture";
import { Motor } from "../motor";
import type { DefinicaoExercicio, EventoMotor, Frame } from "../tipos";
import { PROPORCAO } from "./sintetico";

export const PASTA_FIXTURES = path.resolve(__dirname, "..", "..", "..", "fixtures");

export function definicao(id: string): DefinicaoExercicio {
  const def = exercicioPorId(id);
  if (!def) throw new Error(`Exercício não encontrado: ${id}`);
  return def;
}

export function carregarFixture(caminho: string): Fixture {
  return JSON.parse(readFileSync(caminho, "utf8")) as Fixture;
}

export function listarFixtures(subpasta: string): string[] {
  const pasta = path.join(PASTA_FIXTURES, subpasta);
  return readdirSync(pasta)
    .filter((nome) => nome.endsWith(".json"))
    .map((nome) => path.join(pasta, nome));
}

/** Passa os frames pelo motor e devolve o motor e todos os eventos. */
export function rodar(def: DefinicaoExercicio, frames: Frame[], proporcao = PROPORCAO) {
  const motor = new Motor(def, { proporcao });
  const eventos: EventoMotor[] = [];
  for (const frame of frames) eventos.push(...motor.processar(frame));
  return { motor, eventos, estado: motor.estado, kpis: motor.kpis() };
}

export function rodarFixture(fixture: Fixture) {
  return rodar(definicao(fixture.exercicio), framesDaFixture(fixture), fixture.proporcao);
}

export const dosTipo = <T extends EventoMotor["tipo"]>(eventos: EventoMotor[], tipo: T) =>
  eventos.filter((e): e is Extract<EventoMotor, { tipo: T }> => e.tipo === tipo);

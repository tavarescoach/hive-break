import { describe, expect, it } from "vitest";
import path from "node:path";
import type { Fixture } from "../fixture";
import { carregarFixture, listarFixtures, rodarFixture } from "./apoio";
import { fixtureDoRoteiro, ROTEIROS } from "./sintetico";

/** Tolerância padrão da especificação: 1 rep a cada 10 e 2 s a cada 60 s. */
function conferir(fixture: Fixture) {
  const esperado = fixture.esperado ?? {};
  const { kpis } = rodarFixture(fixture);
  if (esperado.reps_validas !== undefined) {
    const tolerancia = esperado.tolerancia ?? Math.max(1, Math.floor(esperado.reps_validas / 10));
    expect(Math.abs(kpis.reps_validas - esperado.reps_validas), "reps válidas").toBeLessThanOrEqual(tolerancia);
  }
  if (esperado.reps_parciais !== undefined) {
    expect(kpis.reps_parciais, "reps parciais").toBe(esperado.reps_parciais);
  }
  if (esperado.tempo_valido_s !== undefined) {
    const tolerancia = esperado.tolerancia ?? Math.max(2, (2 * esperado.tempo_valido_s) / 60);
    expect(Math.abs(kpis.tempo_valido_s - esperado.tempo_valido_s), "tempo válido").toBeLessThanOrEqual(tolerancia);
  }
}

describe("fixtures sintéticas (JSON em /fixtures/sinteticas)", () => {
  const arquivos = listarFixtures("sinteticas");

  it("existe uma fixture para cada roteiro", () => {
    expect(arquivos.map((a) => path.basename(a, ".json")).sort()).toEqual(Object.keys(ROTEIROS).sort());
  });

  it.each(arquivos.map((a) => [path.basename(a), a]))("%s: contagem exata", (_nome, arquivo) => {
    const fixture = carregarFixture(arquivo);
    expect(fixture.esperado).toBeDefined();
    const { kpis } = rodarFixture(fixture);
    if (fixture.esperado!.reps_validas !== undefined) expect(kpis.reps_validas).toBe(fixture.esperado!.reps_validas);
    conferir(fixture);
  });

  it("os arquivos estão em dia com o gerador (rode npm run fixtures se falhar)", () => {
    for (const arquivo of arquivos) {
      const nome = path.basename(arquivo, ".json");
      expect(carregarFixture(arquivo), nome).toEqual(JSON.parse(JSON.stringify(fixtureDoRoteiro(nome))));
    }
  });
});

describe("fixtures reais (gravações em /fixtures/reais)", () => {
  const arquivos = listarFixtures("reais");

  it.skipIf(arquivos.length > 0)("ainda não há gravações reais (chegam depois do teste no celular)", () => {
    expect(arquivos).toEqual([]);
  });

  it.each(arquivos.map((a) => [path.basename(a), a]))("%s: erro de até 1 em 10", (_nome, arquivo) => {
    const fixture = carregarFixture(arquivo);
    expect(fixture.esperado, "a gravação precisa do campo esperado com a contagem manual").toBeDefined();
    conferir(fixture);
  });
});

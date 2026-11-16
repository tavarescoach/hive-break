import { describe, expect, it } from "vitest";
import { definicao, dosTipo, rodar } from "./apoio";
import { gerarSequencia, parado, polichinelo, repetir, type Trecho } from "./sintetico";

const def = definicao("polichinelo");
const fechado = (s = 1.2) => parado(s, { pes: 0.07, bracos: 8, joelho: 172 });
const cenario = (...trechos: (Trecho | Trecho[])[]) => gerarSequencia([fechado(), ...trechos.flat(), fechado(1)]);

describe("polichinelo", () => {
  it("conta 12 repetições completas", () => {
    const { estado, kpis } = rodar(def, cenario(repetir(12, () => polichinelo())));
    expect(estado.repsValidas).toBe(12);
    expect(estado.repsParciais).toBe(0);
    expect(kpis.cadencia).toBeGreaterThan(55);
    expect(kpis.regularidade).toBeGreaterThan(0.9);
  });

  it("conta certo em ritmo rápido (100 por minuto) a 20 fps", () => {
    const rapido = () => polichinelo({ ida: 0.15, aberto: 0.15, volta: 0.15, fechado: 0.15 });
    const frames = gerarSequencia([fechado(), ...repetir(20, rapido), fechado(1)], { fps: 20, semente: 11 });
    const { estado } = rodar(def, frames);
    expect(Math.abs(estado.repsValidas - 20)).toBeLessThanOrEqual(1);
  });

  it("braços que não passam da cabeça: não conta e avisa", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(6, () => polichinelo({ bracos: 90 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(6);
    const parciais = dosTipo(eventos, "rep_parcial");
    expect(parciais[0].feedback).toBe("Braços acima da cabeça");
    expect(parciais[0].rep.motivo).toBe("bracos_baixos");
  });

  it("pernas pouco abertas viram parcial", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(5, () => polichinelo({ abertura: 0.24 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(5);
    expect(dosTipo(eventos, "rep_parcial")[0].feedback).toBe("Abra mais as pernas");
  });

  it("só levantar os braços, sem abrir as pernas, não conta nada", () => {
    const { estado } = rodar(def, cenario(repetir(5, () => polichinelo({ abertura: 0.07 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(0);
  });

  it("mistura de completas e incompletas", () => {
    const { estado } = rodar(
      def,
      cenario(
        repetir(4, () => polichinelo()),
        repetir(2, () => polichinelo({ bracos: 80 })),
        repetir(4, () => polichinelo()),
      ),
    );
    expect(estado.repsValidas).toBe(8);
    expect(estado.repsParciais).toBe(2);
  });
});

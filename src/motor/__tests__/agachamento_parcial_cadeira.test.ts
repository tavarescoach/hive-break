import { describe, expect, it } from "vitest";
import { definicao, dosTipo, rodar } from "./apoio";
import { agachamento, gerarSequencia, parado, repetir, type Trecho } from "./sintetico";

/** Variação fácil do agachamento livre (Etapa 1A): desce só até a cadeira, não até o fundo. */
const def = definicao("agachamento_parcial_cadeira");
const emPe = (s = 1.2) => parado(s, { joelho: 174 });
const cenario = (...trechos: (Trecho | Trecho[])[]) => gerarSequencia([emPe(), ...trechos.flat(), emPe(1)]);

describe("agachamento parcial na cadeira", () => {
  it("conta 10 repetições até a cadeira (135°, mais raso que o agachamento livre exige)", () => {
    const { estado } = rodar(def, cenario(repetir(10, () => agachamento({ fundo: 135 }))));
    expect(estado.repsValidas).toBe(10);
    expect(estado.repsParciais).toBe(0);
  });

  it("não chega até a cadeira (145°): conta como parcial, com o aviso certo", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(4, () => agachamento({ fundo: 145 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(4);
    expect(dosTipo(eventos, "rep_parcial")[0].feedback).toBe("Desça até a cadeira");
  });

  it("flexão de joelho muito leve (152°) não é rep nem parcial", () => {
    const { estado } = rodar(def, cenario(repetir(4, () => agachamento({ fundo: 152 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(0);
  });

  it("detecta joelhos para dentro, igual ao agachamento livre", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(2, () => agachamento({ fundo: 135, valgo: 0.06 }))));
    expect(estado.repsValidas).toBe(2);
    const erros = dosTipo(eventos, "erro").filter((e) => e.id === "valgo");
    expect(erros.length).toBe(2);
    expect(erros[0].feedback).toBe("Joelhos para fora");
  });

  it("calcula os KPIs do bloco", () => {
    const { kpis } = rodar(def, cenario(repetir(10, () => agachamento({ fundo: 135 }))));
    expect(kpis.reps_validas).toBe(10);
    expect(kpis.amplitude_media).toBeGreaterThan(0.1);
    expect(kpis.fora_quadro_pct).toBe(0);
  });
});

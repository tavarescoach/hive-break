import { describe, expect, it } from "vitest";
import {
  AmostradorSerie, concordancia, CONCORDANCIA_MINIMA, leitura, PESSOAS_MINIMAS, relatorio, type SerieCalibracao,
} from "../calibracao";

let id = 0;
const reps = (exercicio_id: string, pessoa: string, app: number, prof: number): SerieCalibracao => ({
  id: ++id, exercicio_id, tipo: "reps", pessoa, app_reps: app, prof_reps: prof, app_tempo_s: null, prof_tempo_s: null,
});
const tempo = (exercicio_id: string, pessoa: string, app: number, prof: number): SerieCalibracao => ({
  id: ++id, exercicio_id, tipo: "tempo", pessoa, app_reps: null, prof_reps: null, app_tempo_s: app, prof_tempo_s: prof,
});

describe("concordancia", () => {
  it("igual = 1; professor é a referência", () => {
    expect(concordancia(10, 10)).toBe(1);
    expect(concordancia(9, 10)).toBeCloseTo(0.9);
    expect(concordancia(11, 10)).toBeCloseTo(0.9);
  });
  it("professor 0: só vale 1 se o app também deu 0", () => {
    expect(concordancia(0, 0)).toBe(1);
    expect(concordancia(3, 0)).toBe(0);
  });
  it("nunca fica negativa", () => {
    expect(concordancia(30, 10)).toBe(0);
  });
});

describe("relatorio", () => {
  it(`fica pronto com ${PESSOAS_MINIMAS} pessoas, cada uma com média ≥ ${CONCORDANCIA_MINIMA}`, () => {
    const series = ["A1", "A2", "A3", "A4", "A5"].map((p) => reps("agachamento_livre", p, 10, 10));
    const [r] = relatorio(series);
    expect(r).toMatchObject({ exercicioId: "agachamento_livre", series: 5, pessoas: 5, pessoasAprovadas: 5, pronto: true });
    expect(leitura(r)).toMatch(/Pronto/);
  });

  it("4 pessoas boas ainda não bastam e a leitura diz quantas faltam", () => {
    const [r] = relatorio(["A1", "A2", "A3", "A4"].map((p) => reps("prancha", p, 30, 30)));
    expect(r.pronto).toBe(false);
    expect(leitura(r)).toBe("Bom até aqui. Falta testar com 1 pessoa.");
  });

  it("a mesma pessoa em várias séries conta uma vez só (rótulo sem diferenciar maiúsculas)", () => {
    const [r] = relatorio([reps("x", "A1", 10, 10), reps("x", "a1", 10, 10), reps("x", " A1 ", 10, 10)]);
    expect(r.pessoas).toBe(1);
    expect(r.series).toBe(3);
  });

  it("app generoso (conta a mais) e app exigente (conta a menos) aparecem na leitura", () => {
    const generoso = relatorio(["A1", "A2"].map((p) => reps("polichinelo", p, 14, 10)))[0];
    expect(generoso.appContouAMais).toBe(2);
    expect(generoso.diferencaMedia).toBe(4);
    expect(leitura(generoso)).toMatch(/generoso/);
    const exigente = relatorio(["A1", "A2"].map((p) => reps("flexao_braco", p, 6, 10)))[0];
    expect(exigente.appContouAMenos).toBe(2);
    expect(leitura(exigente)).toMatch(/exigente/);
  });

  it("séries de tempo comparam os segundos", () => {
    const [r] = relatorio([tempo("postura_arvore", "A1", 27, 30)]);
    expect(r.concordanciaMedia).toBeCloseTo(0.9);
  });

  it("ordena: prontos primeiro, depois quem tem mais pessoas aprovadas", () => {
    const lista = relatorio([
      reps("b", "A1", 10, 10),
      ...["A1", "A2", "A3", "A4", "A5"].map((p) => reps("a", p, 10, 10)),
      reps("c", "A1", 10, 10), reps("c", "A2", 10, 10),
    ]);
    expect(lista.map((r) => r.exercicioId)).toEqual(["a", "c", "b"]);
  });
});

describe("AmostradorSerie", () => {
  it("guarda no máximo 10 pontos por segundo, com t relativo ao primeiro", () => {
    const a = new AmostradorSerie(10);
    for (let t = 1000; t <= 2000; t += 33) a.registrar(t, 120.456);
    expect(a.pontos.length).toBeLessThanOrEqual(11);
    expect(a.pontos[0]).toEqual([0, 120.46]);
  });
  it("ignora valores ausentes ou inválidos e respeita o teto de pontos", () => {
    const a = new AmostradorSerie(1000, 3);
    a.registrar(0, undefined);
    a.registrar(1, Number.NaN);
    for (let t = 2; t < 20; t++) a.registrar(t, t);
    expect(a.pontos).toHaveLength(3);
  });
});

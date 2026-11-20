import { describe, expect, it } from "vitest";
import { definicao, dosTipo, rodar } from "./apoio";
import { gerarSequencia, parado, polichinelo, repetir, type Trecho } from "./sintetico";

/**
 * Variação fácil do polichinelo (Etapa 1A): mesma posição final (pernas
 * abertas, mãos acima da cabeça), mas sem salto — abre um pé de cada vez.
 * O motor só mede posições, não a trajetória, então o roteiro sintético do
 * polichinelo normal (abrir e fechar) também serve aqui; o que muda é o ritmo
 * mais lento (duracao_minima_ms maior) e as instruções.
 */
const def = definicao("polichinelo_sem_salto");
const fechado = (s = 1.2) => parado(s, { pes: 0.07, bracos: 8, joelho: 172 });
const cenario = (...trechos: (Trecho | Trecho[])[]) => gerarSequencia([fechado(), ...trechos.flat(), fechado(1)]);
/** Passo a passo (sem salto): mais lento que o polichinelo com salto. */
const passo = () => polichinelo({ ida: 0.45, aberto: 0.3, volta: 0.45, fechado: 0.3 });

describe("polichinelo sem salto", () => {
  it("conta 10 repetições completas, no ritmo mais lento do passo a passo", () => {
    const { estado, kpis } = rodar(def, cenario(repetir(10, passo)));
    expect(estado.repsValidas).toBe(10);
    expect(estado.repsParciais).toBe(0);
    expect(kpis.regularidade).toBeGreaterThan(0.9);
  });

  it("braços abaixo dos ombros: não conta e pede para subir", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(6, () => polichinelo({ bracos: 60, ida: 0.45, aberto: 0.3, volta: 0.45, fechado: 0.3 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(6);
    expect(dosTipo(eventos, "rep_parcial")[0].feedback).toBe("Suba os braços");
  });

  it("pernas pouco abertas viram parcial", () => {
    const { estado, eventos } = rodar(def, cenario(repetir(5, () => polichinelo({ abertura: 0.22, ida: 0.45, aberto: 0.3, volta: 0.45, fechado: 0.3 }))));
    expect(estado.repsValidas).toBe(0);
    expect(estado.repsParciais).toBe(5);
    expect(dosTipo(eventos, "rep_parcial")[0].feedback).toBe("Abra mais as pernas");
  });

  it("passos rápidos demais (antifraude, abaixo de 700 ms) não inflam a contagem", () => {
    const rapido = () => polichinelo({ ida: 0.1, aberto: 0.08, volta: 0.1, fechado: 0.08 });
    const { estado } = rodar(def, cenario(repetir(8, rapido)));
    // No máximo a primeira pode valer (não havia ciclo rápido anterior para comparar); o resto não entra.
    expect(estado.repsValidas).toBeLessThanOrEqual(1);
  });
});

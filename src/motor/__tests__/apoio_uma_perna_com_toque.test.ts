import { describe, expect, it } from "vitest";
import { definicao, dosTipo, rodar } from "./apoio";
import { apoio, gerarSequencia, parado } from "./sintetico";

/**
 * Variação fácil do apoio em uma perna (Etapa 1A): o pé livre pode tocar o
 * chão até 2 vezes por série sem reiniciar a contagem (motor/tipos.ts,
 * sustentacao.toques_tolerados).
 */
const def = definicao("apoio_uma_perna_com_toque");

describe("apoio em uma perna, com toque", () => {
  it("sem nenhum toque, funciona igual ao apoio normal", () => {
    const { kpis, eventos } = rodar(def, gerarSequencia([parado(1.5), ...apoio("e", 20), parado(1)]));
    expect(kpis.tempo_valido_s).toBeGreaterThan(19.5);
    expect(kpis.tempo_valido_s).toBeLessThan(20.5);
    expect(dosTipo(eventos, "posicao_inicio").length).toBe(1);
    expect(dosTipo(eventos, "posicao_perdida").length).toBe(0);
  });

  it("1 toque (dentro das 2 toleradas): não encerra a posição, nem credita o tempo do toque", () => {
    const { kpis, eventos } = rodar(
      def,
      gerarSequencia([parado(1.5), ...apoio("e", 6), parado(0.6), ...apoio("e", 6), parado(1)]),
    );
    expect(kpis.tempo_valido_s).toBeGreaterThan(11.4);
    expect(kpis.tempo_valido_s).toBeLessThan(12.6);
    expect(dosTipo(eventos, "posicao_perdida").length).toBe(0);
    // A posição continua a mesma sustentação: só 1 entrada, não 2.
    expect(dosTipo(eventos, "posicao_inicio").length).toBe(1);
  });

  it("o 3º toque (depois de gastar as 2 tolerâncias) encerra a posição normalmente", () => {
    const { kpis, eventos } = rodar(
      def,
      gerarSequencia([
        parado(1.5),
        ...apoio("e", 6),
        parado(0.6), // toque 1 (tolerado)
        ...apoio("e", 6),
        parado(0.6), // toque 2 (tolerado, zera o saldo)
        ...apoio("e", 6),
        parado(1.2), // toque 3: sem saldo, encerra de verdade
        parado(1),
      ]),
    );
    const perdas = dosTipo(eventos, "posicao_perdida");
    expect(perdas.length).toBe(1);
    expect(perdas[0].feedback).toBe("Pé tocou o chão");
    expect(dosTipo(eventos, "posicao_inicio").length).toBe(1);
    expect(kpis.tempo_valido_s).toBeGreaterThan(17);
    expect(kpis.tempo_valido_s).toBeLessThan(19);
  });

  it("depois do saldo de toques acabar, uma nova subida começa uma sustentação nova (mas sem saldo: um novo toque encerra de novo)", () => {
    const { eventos } = rodar(
      def,
      gerarSequencia([
        parado(1.5),
        ...apoio("e", 3),
        parado(0.6), // toque 1
        ...apoio("e", 3),
        parado(0.6), // toque 2
        ...apoio("e", 3),
        parado(1.2), // toque 3: sem saldo, encerra de verdade
        parado(1),
        ...apoio("e", 3), // nova sustentação, do zero — mas sem saldo, então quando o pé volta ao chão no fim do próprio apoio(), encerra de verdade também.
      ]),
    );
    expect(dosTipo(eventos, "posicao_perdida").length).toBe(2);
    expect(dosTipo(eventos, "posicao_inicio").length).toBe(2);
  });
});

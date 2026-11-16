import { describe, expect, it } from "vitest";
import { definicao, dosTipo, rodar } from "./apoio";
import { apoio, gerarSequencia, parado } from "./sintetico";

const def = definicao("apoio_uma_perna");

describe("apoio em uma perna", () => {
  it("conta o tempo com o pé no ar (20 s, erro de até 0,5 s)", () => {
    const { kpis, estado, eventos } = rodar(def, gerarSequencia([parado(1.5), ...apoio("e", 20), parado(1)]));
    expect(kpis.tempo_valido_s).toBeGreaterThan(19.5);
    expect(kpis.tempo_valido_s).toBeLessThan(20.5);
    expect(estado.lado).toBe("e");
    expect(kpis.tempo_valido_e_s).toBe(kpis.tempo_valido_s);
    expect(kpis.tempo_valido_d_s).toBe(0);
    expect(dosTipo(eventos, "posicao_inicio").length).toBe(1);
  });

  it("em pé com os dois pés no chão o tempo não corre", () => {
    const { kpis, eventos } = rodar(def, gerarSequencia([parado(6)], { ruido: 0.008 }));
    expect(kpis.tempo_valido_s).toBe(0);
    expect(dosTipo(eventos, "posicao_inicio").length).toBe(0);
  });

  it("pé tocou o chão: para de contar e registra o evento", () => {
    const { kpis, eventos } = rodar(
      def,
      gerarSequencia([parado(1.5), ...apoio("d", 6), parado(1.2), ...apoio("d", 6), parado(1)]),
    );
    expect(kpis.tempo_valido_s).toBeGreaterThan(11.4);
    expect(kpis.tempo_valido_s).toBeLessThan(12.6);
    const perdas = dosTipo(eventos, "posicao_perdida");
    expect(perdas.length).toBe(2);
    expect(perdas[0].feedback).toBe("Pé tocou o chão");
    expect(perdas[0].lado).toBe("d");
    expect(kpis.maior_sustentacao_s).toBeGreaterThan(5.5);
    expect(kpis.maior_sustentacao_s).toBeLessThan(6.6);
  });

  it("identifica o lado e calcula a simetria", () => {
    const { kpis } = rodar(def, gerarSequencia([parado(1), ...apoio("e", 8), parado(1), ...apoio("d", 4), parado(1)]));
    expect(kpis.tempo_valido_e_s).toBeGreaterThan(7.5);
    expect(kpis.tempo_valido_d_s).toBeGreaterThan(3.5);
    expect(kpis.tempo_valido_d_s).toBeLessThan(4.6);
    expect(kpis.simetria).toBeGreaterThan(0.4);
    expect(kpis.simetria).toBeLessThan(0.6);
  });

  it("mais oscilação do quadril dá menos estabilidade", () => {
    const firme = rodar(def, gerarSequencia([parado(1), ...apoio("e", 10, 0.004), parado(1)])).kpis;
    const bambo = rodar(def, gerarSequencia([parado(1), ...apoio("e", 10, 0.05), parado(1)])).kpis;
    expect(firme.estabilidade!).toBeGreaterThan(0.75);
    expect(bambo.estabilidade!).toBeLessThan(firme.estabilidade! - 0.3);
    expect(bambo.oscilacao!).toBeGreaterThan(firme.oscilacao!);
  });

  it("sair do quadro encerra a sustentação sem culpar o pé", () => {
    const { eventos, kpis } = rodar(
      def,
      gerarSequencia([parado(1), ...apoio("e", 5).slice(0, 2), parado(2.5, { ausente: true }), parado(1)]),
    );
    const perdas = dosTipo(eventos, "posicao_perdida");
    expect(perdas.length).toBe(1);
    expect(perdas[0].feedback).toBeUndefined();
    expect(kpis.tempo_valido_s).toBeGreaterThan(4.3);
    expect(kpis.tempo_valido_s).toBeLessThan(5.3);
  });
});

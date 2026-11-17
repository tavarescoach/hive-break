import { describe, expect, it } from "vitest";
import { avaliarEnquadramento } from "../enquadramento";
import { INDICE_PONTO } from "../pontos";
import { definicao } from "./apoio";
import { gerarFrame, PROPORCAO } from "./sintetico";

const frente = (mudar: Record<string, number> = {}) => {
  const f = gerarFrame(0, {});
  for (const [nome, vis] of Object.entries(mudar)) f.pontos![INDICE_PONTO[nome]].visibility = vis;
  return f.pontos!;
};

describe("avisos de posicionamento", () => {
  it("corpo inteiro de frente: tudo certo", () => {
    expect(avaliarEnquadramento(frente(), definicao("agachamento_livre"), 0.5, PROPORCAO)).toEqual({ ok: true, aviso: null });
  });

  it("ninguém na imagem", () => {
    expect(avaliarEnquadramento(null, definicao("agachamento_livre"), 0.5)).toMatchObject({ ok: false, aviso: expect.stringContaining("Não estou te vendo") });
  });

  it("pés fora da imagem: o agachamento ainda avalia; o polichinelo pede para mostrar os pés", () => {
    const semPes = frente({ tornozelo_e: 0.1, tornozelo_d: 0.1 });
    expect(avaliarEnquadramento(semPes, definicao("agachamento_livre"), 0.5, PROPORCAO).ok).toBe(true);
    expect(avaliarEnquadramento(semPes, definicao("polichinelo"), 0.5, PROPORCAO)).toEqual({
      ok: false, aviso: "Não vejo seus pés: afaste-se um pouco ou incline o celular para baixo.",
    });
  });

  it("joelhos fora da imagem no agachamento", () => {
    const semJoelhos = frente({ joelho_e: 0.2, joelho_d: 0.2 });
    expect(avaliarEnquadramento(semJoelhos, definicao("agachamento_livre"), 0.5, PROPORCAO).aviso).toContain("joelhos");
  });

  it("de frente num exercício de lado: pede para virar", () => {
    expect(avaliarEnquadramento(frente(), definicao("bom_dia_bastao"), 0.5, PROPORCAO)).toEqual({ ok: true, aviso: "Vire de lado para o celular." });
  });
});

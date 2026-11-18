import { describe, expect, it } from "vitest";
import { posicaoDoPasso, proximoPasso, TOTAL_PASSOS, type EstadoOnboarding } from "../onboarding";
import { ETAPAS_PERFIL, faixaEtaria, idade, imc, validarCampo, validarFuso, validarUsername, type Perfil } from "../perfil";
import { lerRespostas } from "../triagem";

const HOJE = new Date(2026, 10, 16);

describe("validação do perfil", () => {
  it("apelido de 3 a 20 caracteres", () => {
    expect(validarCampo("apelido", ["  Lu  "])).toMatchObject({ ok: false });
    expect(validarCampo("apelido", [" Luan "])).toEqual({ ok: true, valor: "Luan" });
    expect(validarCampo("apelido", ["x".repeat(21)])).toMatchObject({ ok: false });
  });

  it("idade mínima de 18 anos, sem limite aos 60", () => {
    expect(validarCampo("data_nascimento", ["2008-11-17"], HOJE)).toMatchObject({ ok: false, erro: expect.stringContaining("18") });
    expect(validarCampo("data_nascimento", ["2008-11-16"], HOJE)).toMatchObject({ ok: true });
    expect(validarCampo("data_nascimento", ["1950-01-01"], HOJE)).toMatchObject({ ok: true });
    expect(validarCampo("data_nascimento", ["16/11/1990"], HOJE)).toMatchObject({ ok: false });
  });

  it("altura de 120 a 230 cm, aceitando metros com vírgula", () => {
    expect(validarCampo("altura_cm", ["172"])).toEqual({ ok: true, valor: 172 });
    expect(validarCampo("altura_cm", ["1,72"])).toEqual({ ok: true, valor: 172 });
    expect(validarCampo("altura_cm", ["119"])).toMatchObject({ ok: false });
    expect(validarCampo("altura_cm", ["231"])).toMatchObject({ ok: false });
    expect(validarCampo("altura_cm", [""])).toMatchObject({ ok: false });
  });

  it("peso de 30 a 250 kg, com uma casa decimal", () => {
    expect(validarCampo("peso_kg", ["70,46"])).toEqual({ ok: true, valor: 70.5 });
    expect(validarCampo("peso_kg", ["29"])).toMatchObject({ ok: false });
    expect(validarCampo("peso_kg", ["251"])).toMatchObject({ ok: false });
  });

  it("escolhas só aceitam opções conhecidas", () => {
    expect(validarCampo("sexo", ["feminino"])).toEqual({ ok: true, valor: "feminino" });
    expect(validarCampo("sexo", ["x"])).toMatchObject({ ok: false });
    expect(validarCampo("dias_semana", ["3"])).toEqual({ ok: true, valor: 3 });
    expect(validarCampo("dias_semana", ["1"])).toMatchObject({ ok: false });
  });

  it("equipamento: múltipla escolha, com 'nenhum' virando lista vazia", () => {
    expect(validarCampo("equipamentos", ["nenhum"])).toEqual({ ok: true, valor: [] });
    expect(validarCampo("equipamentos", ["tapete", "cabo_vassoura"])).toEqual({ ok: true, valor: ["tapete", "cabo_vassoura"] });
    expect(validarCampo("equipamentos", [])).toMatchObject({ ok: false });
    expect(validarCampo("equipamentos", ["halter"])).toMatchObject({ ok: false });
  });

  it("calcula idade, faixa etária (com 60+) e IMC", () => {
    expect(idade("1990-11-17", HOJE)).toBe(35);
    expect(idade("1990-11-16", HOJE)).toBe(36);
    expect([18, 29, 30, 49, 59, 60, 75].map(faixaEtaria)).toEqual(["18-29", "18-29", "30-39", "40-49", "50-59", "60+", "60+"]);
    expect(imc(170, 70)).toBe(24.2);
  });

  it("valida o username: 3 a 20 letras minúsculas, números ou _", () => {
    expect(validarUsername("Luan_Tavares")).toEqual({ ok: true, valor: "luan_tavares" });
    expect(validarUsername("ab")).toMatchObject({ ok: false });
    expect(validarUsername("x".repeat(21))).toMatchObject({ ok: false });
    expect(validarUsername("luan tavares")).toMatchObject({ ok: false });
    expect(validarUsername("luan-tavares")).toMatchObject({ ok: false });
  });

  it("valida o fuso horário", () => {
    expect(validarFuso("America/Sao_Paulo")).toBe("America/Sao_Paulo");
    expect(validarFuso("Marte/Olympus")).toBeNull();
  });
});

describe("triagem", () => {
  it("exige as 7 respostas", () => {
    const completo = new FormData();
    for (let i = 1; i <= 7; i++) completo.set(`q${i}`, i === 3 ? "sim" : "nao");
    expect(lerRespostas(completo)).toEqual({ q1: false, q2: false, q3: true, q4: false, q5: false, q6: false, q7: false });
    completo.delete("q5");
    expect(lerRespostas(completo)).toBeNull();
  });
});

describe("ordem do onboarding", () => {
  const vazio = { onboarding_concluido_em: null } as unknown as Perfil;
  for (const etapa of ETAPAS_PERFIL) (vazio as unknown as Record<string, unknown>)[etapa.campo] = null;
  Object.assign(vazio, { meta_desafios_dia: null, musica_estilo: null });
  const estado = (perfil: Partial<Perfil>, resto: Partial<EstadoOnboarding> = {}): EstadoOnboarding => ({
    perfil: { ...vazio, ...perfil },
    aceites: ["termos", "privacidade", "dados_saude"],
    fezTriagem: false,
    compromisso: null,
    ...resto,
  });
  const preenchido: Partial<Perfil> = {
    apelido: "Ana", data_nascimento: "1990-01-01", sexo: "feminino", altura_cm: 165, peso_kg: 60,
    objetivo: "forca", nivel_atividade: "ativo", dias_semana: 3, equipamentos: [],
  };

  it("segue termos → perfil → triagem → meta → câmera → música → trilha", () => {
    expect(proximoPasso(estado({}, { aceites: ["termos"] }))).toBe("/onboarding/termos");
    expect(proximoPasso(estado({}))).toBe("/onboarding/perfil/apelido");
    expect(proximoPasso(estado({ apelido: "Ana", data_nascimento: "1990-01-01", sexo: "feminino" }))).toBe("/onboarding/perfil/altura");
    expect(proximoPasso(estado(preenchido))).toBe("/onboarding/triagem");
    expect(proximoPasso(estado(preenchido, { fezTriagem: true }))).toBe("/onboarding/meta");
    expect(proximoPasso(estado({ ...preenchido, meta_desafios_dia: 1 }, { fezTriagem: true }))).toBe("/onboarding/meta");
    expect(proximoPasso(estado({ ...preenchido, meta_desafios_dia: 1 }, { fezTriagem: true, compromisso: 7 }))).toBe("/camera");
    expect(proximoPasso(estado({ ...preenchido, meta_desafios_dia: 1, musica_estilo: "lofi" }, { fezTriagem: true, compromisso: 7 }))).toBe("/onboarding/musica");
    expect(proximoPasso(estado({ onboarding_concluido_em: "2026-11-16" }))).toBe("/trilha");
  });

  it("lista vazia de equipamento conta como respondida", () => {
    expect(proximoPasso(estado({ ...preenchido, equipamentos: [] }))).toBe("/onboarding/triagem");
    expect(proximoPasso(estado({ ...preenchido, equipamentos: null }))).toBe("/onboarding/perfil/equipamento");
  });

  it("a barra de progresso cobre todas as telas, em ordem", () => {
    const rotas = ["/onboarding/termos", ...ETAPAS_PERFIL.map((e) => `/onboarding/perfil/${e.id}`), "/onboarding/triagem", "/onboarding/meta", "/camera", "/onboarding/musica"];
    expect(rotas.map(posicaoDoPasso)).toEqual(rotas.map((_, i) => i + 1));
    expect(rotas).toHaveLength(TOTAL_PASSOS);
  });
});

import { describe, expect, it } from "vitest";
import {
  classificarErroCodigo, codigoCompleto, emailValido, MENSAGENS_CODIGO, mensagemErroCodigo, normalizarEmail, soDigitos,
  tipoVerificacao,
} from "../codigo-email";
import { erroDeFormato, mensagemDoMotivo, normalizarUsername } from "../username";
import { avisoResultadoNaoSalvo, destinoVisitante, diasAteApagar, exigirEmailAntesDoDesafio } from "../visitante";

describe("username: formato", () => {
  it("aceita letras, números, ponto e sublinhado, sem diferenciar maiúscula", () => {
    expect(erroDeFormato("joana.silva_23")).toBeNull();
    expect(erroDeFormato("  Joana  ")).toBeNull();
    expect(normalizarUsername("  Joana.Silva ")).toBe("joana.silva");
  });

  it("recusa curto, longo, espaço, acento e hífen", () => {
    expect(erroDeFormato("jo")).toMatch(/pelo menos 3/);
    expect(erroDeFormato("a".repeat(21))).toMatch(/no máximo 20/);
    expect(erroDeFormato("joana silva")).toMatch(/Sem espaço/);
    expect(erroDeFormato("joão")).toMatch(/sem acento/);
    expect(erroDeFormato("joana-silva")).toMatch(/sem acento/);
  });

  it("tem mensagem para cada motivo do banco", () => {
    for (const motivo of ["formato", "reservado", "proibido", "em_uso", "espera"]) expect(mensagemDoMotivo(motivo)).toBeTruthy();
    expect(mensagemDoMotivo("outro")).toBeNull();
  });
});

describe("código por e-mail", () => {
  it("colar tira o que não é dígito e corta em 6", () => {
    expect(soDigitos("Seu código Hive Break: 123 456")).toBe("123456");
    expect(soDigitos("12-34-56-78")).toBe("123456");
    expect(codigoCompleto("123456")).toBe(true);
    expect(codigoCompleto("12345")).toBe(false);
  });

  it("valida e normaliza o e-mail", () => {
    expect(emailValido(" Ana@Gmail.com ")).toBe(true);
    expect(normalizarEmail(" Ana@Gmail.com ")).toBe("ana@gmail.com");
    for (const ruim of ["ana", "ana@", "ana@gmail", "ana @gmail.com", ""]) expect(emailValido(ruim), ruim).toBe(false);
  });

  it("a conversão do visitante verifica como troca de e-mail; o login como e-mail", () => {
    expect(tipoVerificacao("conversao")).toBe("email_change");
    expect(tipoVerificacao("login")).toBe("email");
    expect(tipoVerificacao("migracao")).toBe("email");
  });

  it("errado conta as tentativas; o 5º erro bloqueia; passado de 10 min é expirado", () => {
    expect(classificarErroCodigo(4, 30)).toEqual({ tipo: "errado", restantes: 4 });
    expect(mensagemErroCodigo(classificarErroCodigo(4, 30))).toBe("Código errado. Faltam 4 tentativas.");
    expect(mensagemErroCodigo(classificarErroCodigo(1, 30))).toBe("Código errado. Falta 1 tentativa.");
    expect(classificarErroCodigo(0, 30)).toEqual({ tipo: "bloqueado" });
    expect(classificarErroCodigo(3, 600)).toEqual({ tipo: "expirado" });
    expect(mensagemErroCodigo({ tipo: "expirado" })).toBe("Código expirado. Mandar outro?");
  });

  it("mensagens da seção 6", () => {
    expect(MENSAGENS_CODIGO.enviado("ana@gmail.com")).toBe("Código enviado para ana@gmail.com. Confira também o spam.");
  });
});

describe("destino do visitante", () => {
  const base = { temUsername: true, fezDeclaracao: true, desafiosConcluidos: 0, desafio: "n1u1d01" };

  it("sem username ou declaração, volta para /comecar", () => {
    expect(destinoVisitante({ ...base, temUsername: false }, false)).toBe("/comecar");
    expect(destinoVisitante({ ...base, fezDeclaracao: false }, false)).toBe("/comecar");
  });

  it("joga antes do e-mail por padrão; com a chave ligada, pede o código antes", () => {
    expect(destinoVisitante(base, false)).toBe("/desafio/n1u1d01");
    expect(destinoVisitante(base, true)).toBe("/salvar");
  });

  it("depois de jogar, vai salvar o resultado", () => {
    expect(destinoVisitante({ ...base, desafiosConcluidos: 1 }, false)).toBe("/salvar");
  });

  it("EXIGIR_EMAIL_ANTES_DO_DESAFIO é false por padrão", () => {
    expect(exigirEmailAntesDoDesafio(undefined)).toBe(false);
    expect(exigirEmailAntesDoDesafio("")).toBe(false);
    expect(exigirEmailAntesDoDesafio("false")).toBe(false);
    expect(exigirEmailAntesDoDesafio("true")).toBe(true);
    expect(exigirEmailAntesDoDesafio("1")).toBe(true);
  });

  it("aviso do resultado não salvo pelo dia no fuso", () => {
    const agora = new Date("2026-11-18T12:00:00-03:00");
    expect(avisoResultadoNaoSalvo(new Date("2026-11-18T08:00:00-03:00"), agora)).toBe("Seu resultado de hoje ainda não está salvo.");
    expect(avisoResultadoNaoSalvo(new Date("2026-11-17T23:30:00-03:00"), agora)).toBe("Seu resultado de ontem ainda não está salvo.");
    expect(avisoResultadoNaoSalvo(new Date("2026-11-15T10:00:00-03:00"), agora)).toBe("Seu resultado de 3 dias atrás ainda não está salvo.");
  });

  it("dias até apagar", () => {
    const agora = new Date("2026-11-18T12:00:00Z");
    expect(diasAteApagar(new Date("2026-11-18T10:00:00Z"), agora)).toBe(7);
    expect(diasAteApagar(new Date("2026-11-12T10:00:00Z"), agora)).toBe(1);
    expect(diasAteApagar(new Date("2026-11-01T10:00:00Z"), agora)).toBe(0);
  });
});

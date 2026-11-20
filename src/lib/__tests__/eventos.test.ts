import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  marcarFtueAberto,
  registrarEvento,
  registrarEventoAntesDeIr,
  registrarPrimeiraRepSeNecessario,
  type NomeEvento,
} from "../eventos";

const rpc = vi.fn();
vi.mock("@/lib/supabase/navegador", () => ({ criarClienteNavegador: () => ({ rpc }) }));

/** Os 8 eventos aceitos pela função registrar_evento (migração 20261126000400_eventos.sql). */
const TODOS_OS_EVENTOS: NomeEvento[] = [
  "ftue_aberto",
  "comecar_tocado",
  "declaracao_aceita",
  "camera_permitida",
  "camera_negada",
  "preparo_iniciado",
  "primeira_rep",
  "desafio_concluido",
];

/** Guarda tudo que foi para sessionStorage num Map, sem precisar de DOM (o projeto testa em environment: "node"). */
function instalarSessionStorageFalso() {
  const dados = new Map<string, string>();
  (globalThis as { sessionStorage?: Storage }).sessionStorage = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v),
    removeItem: (k: string) => void dados.delete(k),
    clear: () => dados.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("registrarEvento", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it.each(TODOS_OS_EVENTOS)("chama registrar_evento com p_nome = %s", (nome) => {
    registrarEvento(nome);
    expect(rpc).toHaveBeenCalledWith("registrar_evento", { p_nome: nome, p_props: {} });
  });

  it("manda os props junto, sem mexer neles", () => {
    registrarEvento("desafio_concluido", { challenge_id: "n1u1d01", modo: "camera" });
    expect(rpc).toHaveBeenCalledWith("registrar_evento", {
      p_nome: "desafio_concluido",
      p_props: { challenge_id: "n1u1d01", modo: "camera" },
    });
  });

  it("loga no console quando a rpc devolve erro (o PostgREST não rejeita a promessa nesse caso)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Could not find the function" } });
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarEvento("ftue_aberto");
    await Promise.resolve();
    await Promise.resolve();
    expect(erro).toHaveBeenCalledWith(
      "[eventos] registrar_evento(ftue_aberto) falhou:",
      "Could not find the function",
      expect.anything(),
    );
    erro.mockRestore();
  });

  it("loga no console quando a chamada falha de rede (promessa rejeitada)", async () => {
    rpc.mockReturnValueOnce(Promise.reject(new Error("offline")));
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    registrarEvento("ftue_aberto");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(erro).toHaveBeenCalledWith("[eventos] registrar_evento(ftue_aberto) falhou (rede):", expect.any(Error));
    erro.mockRestore();
  });
});

describe("registrarEventoAntesDeIr", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("devolve uma promessa (dá para esperar antes de navegar, ex.: BotaoComecar)", async () => {
    await expect(registrarEventoAntesDeIr("comecar_tocado")).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("registrar_evento", { p_nome: "comecar_tocado", p_props: {} });
  });
});

describe("registrarPrimeiraRepSeNecessario", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
    instalarSessionStorageFalso();
  });
  afterEach(() => {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  });

  it("manda o exercício e os ms desde ftue_aberto", () => {
    const antes = Date.now();
    marcarFtueAberto();
    registrarPrimeiraRepSeNecessario("agachamento_livre");
    expect(rpc).toHaveBeenCalledTimes(1);
    const [, args] = rpc.mock.calls[0] as [string, { p_nome: string; p_props: Record<string, unknown> }];
    expect(args.p_nome).toBe("primeira_rep");
    expect(args.p_props.exercicio_id).toBe("agachamento_livre");
    expect(args.p_props.ms_desde_ftue_aberto as number).toBeGreaterThanOrEqual(0);
    expect(args.p_props.ms_desde_ftue_aberto as number).toBeLessThan(Date.now() - antes + 100);
  });

  it("só registra uma vez por aba, mesmo chamando de novo com outro exercício", () => {
    registrarPrimeiraRepSeNecessario("agachamento_livre");
    registrarPrimeiraRepSeNecessario("polichinelo");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

/**
 * Garante que os 8 eventos continuam instrumentados nos pontos certos do app
 * (e não só que o helper `registrarEvento` funciona). Não é um teste de
 * comportamento de UI (o projeto não tem infraestrutura de montar componente,
 * ver vitest.config.ts: environment "node"), mas pega a regressão mais comum:
 * alguém mexe no arquivo e apaga a chamada por engano.
 */
describe("os 8 eventos estão instrumentados nos lugares certos", () => {
  const raiz = path.resolve(__dirname, "..", "..");
  const ler = (relativo: string) => readFileSync(path.join(raiz, relativo), "utf8");

  const landing = ler("app/(publico)/RegistrarFtue.tsx");
  const botao = ler("app/(publico)/BotaoComecar.tsx");
  const comecarAcoes = ler("app/(publico)/comecar/acoes.ts");
  const execucao = ler("app/desafio/[id]/Execucao.tsx");
  const desafioAcoes = ler("app/desafio/[id]/acoes.ts");

  it.each([
    ["ftue_aberto", landing, "ftue_aberto"],
    ["comecar_tocado", botao, "comecar_tocado"],
    ["declaracao_aceita", comecarAcoes, "declaracao_aceita"],
    ["camera_permitida", execucao, "camera_permitida"],
    ["camera_negada", execucao, "camera_negada"],
    ["preparo_iniciado", execucao, "preparo_iniciado"],
    // primeira_rep é disparado por este helper, não pelo nome do evento direto.
    ["primeira_rep", execucao, "registrarPrimeiraRepSeNecessario"],
    ["desafio_concluido", desafioAcoes, "desafio_concluido"],
  ] as const)('"%s" aparece no arquivo que deveria chamá-lo', (_nome, arquivo, trecho) => {
    expect(arquivo).toContain(trecho);
  });
});

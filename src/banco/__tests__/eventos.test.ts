import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

let db: PGlite;

beforeAll(async () => {
  db = await criarBanco();
});

const chamar = (usuario: string | null, nome: string, props?: unknown) =>
  como(db, { usuario }, (tx) => tx.query("select public.registrar_evento($1, $2)", [nome, JSON.stringify(props ?? {})]));

const todas = () =>
  db.query<{ nome: string; props: Record<string, unknown>; usuario_id: string | null }>(
    "select nome, props, usuario_id from public.eventos order by id",
  );
const deUsuario = (usuarioId: string) =>
  db.query<{ nome: string; props: Record<string, unknown>; usuario_id: string | null }>(
    "select nome, props, usuario_id from public.eventos where usuario_id = $1 order by id",
    [usuarioId],
  );

describe("eventos do primeiro acesso (Etapa 1A)", () => {
  it("visitante sem login (anon) consegue registrar ftue_aberto, com usuario_id nulo", async () => {
    await chamar(null, "ftue_aberto");
    const { rows } = await todas();
    const evento = rows.find((r) => r.nome === "ftue_aberto");
    expect(evento?.usuario_id).toBeNull();
  });

  it("usuário autenticado grava o próprio id e os props", async () => {
    const ana = await criarUsuario(db, "Ana eventos");
    await chamar(ana, "primeira_rep", { exercicio_id: "agachamento_livre", ms_desde_ftue_aberto: 4200 });
    const { rows } = await deUsuario(ana);
    expect(rows).toEqual([{ nome: "primeira_rep", usuario_id: ana, props: { exercicio_id: "agachamento_livre", ms_desde_ftue_aberto: 4200 } }]);
  });

  it("recusa um nome de evento fora da lista", async () => {
    await expect(chamar(null, "evento_qualquer")).rejects.toThrow(/check constraint|eventos_nome_check/);
  });

  it("RLS: ninguém lê a tabela direto, só pela função", async () => {
    await expect(como(db, { usuario: null }, (tx) => tx.query("select * from public.eventos"))).rejects.toThrow(/permission denied/);
    const ana = await criarUsuario(db, "Ana eventos 2");
    await expect(como(db, { usuario: ana }, (tx) => tx.query("select * from public.eventos"))).rejects.toThrow(/permission denied/);
  });
});

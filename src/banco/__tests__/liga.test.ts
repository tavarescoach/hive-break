import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

let db: PGlite;
let semana: string;

/** Usuário com cadastro concluído, na divisão pedida. */
async function pessoa(nome: string, divisao = "bronze") {
  const id = await criarUsuario(db, nome);
  await db.query(
    "update public.profiles set apelido = $2, onboarding_concluido_em = now(), meta_desafios_dia = 3, divisao_atual = $3 where id = $1",
    [id, nome, divisao],
  );
  await db.query("insert into public.user_level_progress (user_id, level_id, liberado) values ($1, 1, true)", [id]);
  return id;
}

const rpc = <T>(usuario: string, sql: string, params: unknown[] = []) =>
  como(db, { usuario }, async (tx) => (await tx.query<{ r: T }>(`select ${sql} as r`, params)).rows[0].r);
const blocos = (reps: number, fora = 0) => `(select jsonb_agg(jsonb_build_object('ordem', ordem, 'reps_validas', ${reps}, 'reps_parciais', 0,
  'tempo_valido_s', 0, 'fora_quadro_pct', ${fora}, 'kpis', '{}'::jsonb)) from public.challenge_blocks where challenge_id = $1)`;
const concluir = (usuario: string, desafio: string, fora = 0) =>
  rpc(usuario, `public.finalizar_desafio($1, 'camera', ${blocos(10, fora)})`, [desafio]);
const concluirManual = (usuario: string, desafio: string) => rpc(usuario, "public.finalizar_desafio($1, 'manual', '[]')", [desafio]);

async function membro(usuario: string) {
  const { rows } = await db.query<{ league_id: string; divisao: string; pontos: string; semana_inicio: string }>(
    `select m.league_id, l.divisao, m.pontos, l.semana_inicio::text from public.league_members m
     join public.leagues l on l.id = m.league_id where m.user_id = $1 and l.semana_inicio = $2::date`,
    [usuario, semana],
  );
  return rows[0];
}

/** Grupo montado direto no banco: uma pessoa por pontuação, na ordem dada. */
async function grupo(divisao: string, inicio: string, pontos: number[], prefixo: string) {
  const { rows } = await db.query<{ id: string }>(
    "insert into public.leagues (divisao, semana_inicio, semana_fim) values ($1, $2::date, $2::date + 6) returning id",
    [divisao, inicio],
  );
  const ids: string[] = [];
  for (const [i, p] of pontos.entries()) {
    const id = await pessoa(`${prefixo} ${i + 1}`, divisao);
    await db.query("insert into public.league_members (league_id, user_id, pontos, pontos_em) values ($1, $2, $3, now() + $4 * interval '1 second')",
      [rows[0].id, id, p, i]);
    ids.push(id);
  }
  return { liga: rows[0].id, ids };
}

const resultados = async (liga: string) =>
  (await db.query<{ posicao_final: number; resultado: string }>(
    "select posicao_final, resultado from public.league_members where league_id = $1 order by posicao_final", [liga])).rows
    .map((r) => r.resultado);
const divisao = async (id: string) =>
  (await db.query<{ divisao_atual: string }>("select divisao_atual from public.profiles where id = $1", [id])).rows[0].divisao_atual;

beforeAll(async () => {
  db = await criarBanco();
  semana = (await db.query<{ s: string }>("select public.liga_semana_inicio()::text as s")).rows[0].s;
});

describe("pontos e entrada na liga", () => {
  it("a semana começa na segunda", async () => {
    const { rows } = await db.query<{ dia: number }>("select extract(isodow from $1::date)::int as dia", [semana]);
    expect(rows[0].dia).toBe(1);
  });

  it("entra num grupo da própria divisão no 1º desafio com câmera, com o XP como pontos", async () => {
    const ana = await pessoa("Ana liga", "prata");
    expect(await membro(ana)).toBeUndefined();
    await concluir(ana, "n1u1d01");
    expect(await membro(ana)).toMatchObject({ divisao: "prata", pontos: "15.00" }); // 10 do desafio + 5 do 1º do dia
    await concluir(ana, "n1u1d02");
    expect(await membro(ana)).toMatchObject({ pontos: "25.00" });
    const { rows } = await db.query<{ valido_para_liga: boolean }>(
      "select distinct valido_para_liga from public.challenge_attempts where user_id = $1", [ana]);
    expect(rows).toEqual([{ valido_para_liga: true }]);
  });

  it("modo manual e desafio com o corpo fora do quadro não pontuam", async () => {
    const bia = await pessoa("Bia manual");
    await concluirManual(bia, "n1u1d01");
    expect(await membro(bia)).toBeUndefined();
    const caio = await pessoa("Caio fora");
    await concluir(caio, "n1u1d01", 45);
    expect(await membro(caio)).toBeUndefined();
    await concluir(caio, "n1u1d02", 10);
    expect(await membro(caio)).toMatchObject({ pontos: "10.00" });
  });

  it("convite, baú e nivelamento não contam", async () => {
    const duda = await pessoa("Duda convite");
    await db.query("insert into public.xp_events (user_id, tipo, valor) values ($1, 'convite', 20), ($1, 'bau', 10), ($1, 'nivelamento', 30)", [duda]);
    expect(await membro(duda)).toBeUndefined();
  });

  it("com 30 pessoas no grupo, quem chega abre outro", async () => {
    const cheio = await grupo("ouro", semana, Array.from({ length: 30 }, (_, i) => 100 - i), "Ouro");
    const eva = await pessoa("Eva ouro", "ouro");
    await concluir(eva, "n1u1d01");
    const m = await membro(eva);
    expect(m.divisao).toBe("ouro");
    expect(m.league_id).not.toBe(cheio.liga);
    const fabio = await pessoa("Fabio ouro", "ouro");
    await concluir(fabio, "n1u1d01");
    expect((await membro(fabio)).league_id).toBe(m.league_id);
  });
});

describe("fechamento da semana", () => {
  let passada: string;
  beforeAll(async () => {
    passada = (await db.query<{ s: string }>("select ($1::date - 7)::text as s", [semana])).rows[0].s;
  });

  it("é proporcional: 15 pessoas, 4 sobem e 3 descem; sobe ganha protetor e a conquista", async () => {
    const g = await grupo("prata", passada, Array.from({ length: 15 }, (_, i) => 200 - i * 10), "Prata");
    await db.query("select public.fechar_ligas()");
    expect(await resultados(g.liga)).toEqual([
      ...Array(4).fill("subiu"), ...Array(8).fill("manteve"), ...Array(3).fill("desceu"),
    ]);
    expect(await divisao(g.ids[0])).toBe("ouro");
    expect(await divisao(g.ids[4])).toBe("prata");
    expect(await divisao(g.ids[14])).toBe("bronze");
    const protetor = await db.query<{ protetores: number }>("select protetores from public.streaks where user_id = $1", [g.ids[0]]);
    expect(protetor.rows[0].protetores).toBe(1);
    const conquista = await db.query("select 1 from public.user_achievements where user_id = $1 and achievement_id = 'primeira_subida'", [g.ids[0]]);
    expect(conquista.rows).toHaveLength(1);
    const status = await db.query<{ status: string }>("select status from public.leagues where id = $1", [g.liga]);
    expect(status.rows[0].status).toBe("fechada");
  });

  it("30 pessoas: 7 sobem e 5 descem; grupo pequeno: só o 1º sobe", async () => {
    const cheio = await grupo("safira", passada, Array.from({ length: 30 }, (_, i) => 300 - i), "Safira");
    const pequeno = await grupo("safira", passada, [50, 40, 30], "Safira pequeno");
    await db.query("select public.fechar_ligas()");
    const r = await resultados(cheio.liga);
    expect(r.filter((x) => x === "subiu")).toHaveLength(7);
    expect(r.filter((x) => x === "desceu")).toHaveLength(5);
    expect(await resultados(pequeno.liga)).toEqual(["subiu", "manteve", "manteve"]);
  });

  it("Bronze não desce, Diamante não sobe, e no empate fica na frente quem chegou antes", async () => {
    const bronze = await grupo("bronze", passada, [60, 50, 40, 30, 20, 10], "Bronze");
    const diamante = await grupo("diamante", passada, [80, 80, 70, 60, 50, 40], "Diamante");
    await db.query("select public.fechar_ligas()");
    expect(await resultados(bronze.liga)).toEqual(["subiu", ...Array(5).fill("manteve")]);
    expect(await resultados(diamante.liga)).toEqual([...Array(5).fill("manteve"), "desceu"]);
    const empate = await db.query<{ user_id: string }>(
      "select user_id from public.league_members where league_id = $1 and posicao_final = 1", [diamante.liga]);
    expect(empate.rows[0].user_id).toBe(diamante.ids[0]);
  });
});

describe("tela da liga", () => {
  it("fora de grupo: mostra a divisão e o resultado da semana passada", async () => {
    const passada = (await db.query<{ s: string }>("select ($1::date - 7)::text as s", [semana])).rows[0].s;
    const g = await grupo("bronze", passada, [90, 10, 5, 3, 2], "Volta");
    const tela = await rpc<Record<string, unknown>>(g.ids[0], "public.ler_liga()"); // fecha a semana passada na leitura
    expect(tela).toMatchObject({ no_grupo: false, divisao: "prata", semana_passada: { divisao: "bronze", posicao: 1, resultado: "subiu" } });
  });

  it("mostra só o pódio, a pessoa e quem está logo acima; a zona de descida é só dela", async () => {
    const g = await grupo("diamante", semana, [100, 90, 80, 70, 60, 50, 40, 30, 20, 10], "Tela");
    const nona = g.ids[8];
    const tela = await rpc<{
      zona: string; posicao: number; pontos: number; tamanho: number; sobem: number; descem: number;
      faltam_para_subir: number | null; faltam_para_ficar: number | null; linhas: { posicao: number; eu: boolean; pontos: number }[];
    }>(nona, "public.ler_liga()");
    expect(tela).toMatchObject({ posicao: 9, pontos: 20, tamanho: 10, sobem: 0, descem: 2, zona: "descida", faltam_para_ficar: 11, faltam_para_subir: null });
    expect(tela.linhas.map((l) => l.posicao)).toEqual([1, 2, 3, 8, 9]);
    expect(tela.linhas.filter((l) => l.eu).map((l) => l.posicao)).toEqual([9]);
    expect(JSON.stringify(tela)).not.toContain("user_id");

    const quinta = await rpc<{ zona: string; linhas: { posicao: number }[] }>(g.ids[4], "public.ler_liga()");
    expect(quinta.zona).toBe("meio");
    expect(quinta.linhas.map((l) => l.posicao)).toEqual([1, 2, 3, 4, 5]);
  });

  it("mostra quanto falta para subir", async () => {
    const g = await grupo("prata", semana, [100, 90, 80, 70, 60, 50, 40, 30, 20, 10], "Sobe");
    const tela = await rpc<{ zona: string; sobem: number; faltam_para_subir: number }>(g.ids[5], "public.ler_liga()");
    expect(tela).toMatchObject({ sobem: 2, zona: "meio", faltam_para_subir: 90 - 50 + 1 });
    expect(await rpc(g.ids[0], "public.ler_liga() ->> 'zona'")).toBe("subida");
  });

  it("o cliente não chama o fechamento nem soma pontos", async () => {
    const ana = await pessoa("Ana cliente");
    await expect(rpc(ana, "public.fechar_ligas()")).rejects.toThrow(/permission denied/);
  });
});

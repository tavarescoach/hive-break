import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario, rodarMigracao } from "../banco-de-teste";

let db: PGlite;
let semana: string;
let passada: string;

/** Usuário com cadastro concluído, na divisão pedida. */
async function pessoa(nome: string, divisao = "bronze", convidadoPor?: string) {
  const id = await criarUsuario(db, nome);
  if (convidadoPor) await db.query("insert into public.invites (inviter_id, invitee_id) values ($1, $2)", [convidadoPor, id]);
  await db.query(
    "update public.profiles set apelido = $2, onboarding_concluido_em = now(), meta_desafios_dia = 3, divisao_atual = $3, convidado_por = $4 where id = $1",
    [id, nome, divisao, convidadoPor ?? null],
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

/** Tentativa gravada direto no banco, com o XP dela (para desafios fora de ordem na trilha). */
async function tentativa(usuario: string, desafio: string, modo: "camera" | "manual", xp: number) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.challenge_attempts (user_id, challenge_id, dificuldade, modo, status, concluido_em, xp)
     values ($1, $2, 1, $3, 'concluido', now(), $4) returning id`, [usuario, desafio, modo, xp]);
  await db.query("insert into public.xp_events (user_id, tipo, valor, attempt_id) values ($1, 'desafio', $2, $3)", [usuario, xp, rows[0].id]);
}

async function membro(usuario: string) {
  const { rows } = await db.query<{ league_id: string; divisao: string; pontos: string }>(
    `select m.league_id, l.divisao, m.pontos from public.league_members m
     join public.leagues l on l.id = m.league_id where m.user_id = $1 and l.semana_inicio = $2::date`,
    [usuario, semana],
  );
  return rows[0];
}

const tamanhos = async (divisao: string, inicio = semana) =>
  (await db.query<{ n: number }>(
    `select count(m.user_id)::int as n from public.leagues l left join public.league_members m on m.league_id = l.id
     where l.divisao = $1 and l.semana_inicio = $2::date group by l.id order by n desc`, [divisao, inicio])).rows.map((r) => r.n);

/** Grupo montado direto no banco: uma pessoa por pontuação, na ordem dada. */
async function grupo(divisao: string, inicio: string, pontos: number[], prefixo: string) {
  // Cria as pessoas antes do grupo: ao terminar o cadastro elas entram na liga desta semana.
  const ids: string[] = [];
  for (const i of pontos.keys()) ids.push(await pessoa(`${prefixo} ${i + 1}`, divisao));
  const { rows } = await db.query<{ id: string }>(
    "insert into public.leagues (divisao, semana_inicio, semana_fim) values ($1, $2::date, $2::date + 6) returning id",
    [divisao, inicio],
  );
  for (const [i, id] of ids.entries()) {
    // Fica só neste grupo nesta semana e nas seguintes.
    await db.query(
      `delete from public.league_members m using public.leagues l
       where m.league_id = l.id and m.user_id = $1 and l.semana_inicio >= $2::date`, [id, inicio]);
    await db.query("insert into public.league_members (league_id, user_id, pontos, pontos_em) values ($1, $2, $3, now() + $4 * interval '1 second')",
      [rows[0].id, id, pontos[i], i]);
  }
  return { liga: rows[0].id, ids };
}

const resultados = async (liga: string) =>
  (await db.query<{ resultado: string }>(
    "select resultado from public.league_members where league_id = $1 order by posicao_final", [liga])).rows.map((r) => r.resultado);
const divisao = async (id: string) =>
  (await db.query<{ divisao_atual: string }>("select divisao_atual from public.profiles where id = $1", [id])).rows[0].divisao_atual;

async function novoBanco() {
  db = await criarBanco();
  semana = (await db.query<{ s: string }>("select public.liga_semana_inicio()::text as s")).rows[0].s;
  passada = (await db.query<{ s: string }>("select ($1::date - 7)::text as s", [semana])).rows[0].s;
}

describe("montagem dos grupos", () => {
  beforeAll(novoBanco);

  it("a semana começa na segunda", async () => {
    const { rows } = await db.query<{ dia: number }>("select extract(isodow from $1::date)::int as dia", [semana]);
    expect(rows[0].dia).toBe(1);
  });

  it("na virada, todo mundo com cadastro completo entra, em grupos de até 15 do mesmo tamanho", async () => {
    for (let i = 0; i < 20; i++) await pessoa(`Bronze ${i}`);
    for (let i = 0; i < 30; i++) await pessoa(`Prata ${i}`, "prata");
    for (let i = 0; i < 40; i++) await pessoa(`Ouro ${i}`, "ouro");
    await criarUsuario(db, "Sem cadastro"); // cadastro incompleto não entra
    const proxima = (await db.query<{ s: string }>("select ($1::date + 7)::text as s", [semana])).rows[0].s;
    await db.query("select public.liga_formar_semana($1::date)", [proxima]);
    expect(await tamanhos("bronze", proxima)).toEqual([10, 10]);
    expect(await tamanhos("prata", proxima)).toEqual([15, 15]);
    expect(await tamanhos("ouro", proxima)).toEqual([14, 13, 13]);
  });

  it("no meio da semana, quem termina o cadastro entra no grupo menor; com todos cheios, abre outro", async () => {
    // Nesta semana as pessoas foram chegando uma a uma: os grupos enchem até 15.
    expect(await tamanhos("bronze")).toEqual([15, 5]);
    expect(await tamanhos("ouro")).toEqual([15, 15, 10]);
    await pessoa("Bronze nova");
    expect(await tamanhos("bronze")).toEqual([15, 6]);
    await pessoa("Prata nova", "prata");
    expect(await tamanhos("prata")).toEqual([15, 15, 1]);
  });

  it("quem foi convidado entra no grupo de quem convidou, se tiver vaga", async () => {
    const { rows } = await db.query<{ id: string }>("select id from public.profiles where apelido = 'Bronze 17'");
    const convidada = await pessoa("Convidada", "bronze", rows[0].id);
    expect((await membro(convidada)).league_id).toBe((await membro(rows[0].id)).league_id);
    const tela = await rpc<{ no_grupo: boolean; pontos: number; tamanho: number }>(convidada, "public.ler_liga()");
    expect(tela).toMatchObject({ no_grupo: true, pontos: 0, tamanho: 7 });
  });
});

describe("pontos", () => {
  beforeAll(novoBanco);

  it("desafio com câmera pontua; manual não pontua, mas a pessoa está no grupo com 0", async () => {
    const ana = await pessoa("Ana");
    await concluir(ana, "n1u1d01");
    expect(await membro(ana)).toMatchObject({ divisao: "bronze", pontos: "15.00" }); // 10 do desafio + 5 do 1º do dia
    const bia = await pessoa("Bia");
    await concluirManual(bia, "n1u1d01");
    expect(await membro(bia)).toMatchObject({ pontos: "0.00" });
  });

  it("corpo fora do quadro não pontua", async () => {
    const caio = await pessoa("Caio");
    await concluir(caio, "n1u1d01", 45);
    expect(await membro(caio)).toMatchObject({ pontos: "0.00" });
  });

  it("respiração guiada pontua, mesmo sem câmera", async () => {
    const duda = await pessoa("Duda");
    await tentativa(duda, "n1u1d08", "manual", 10);
    expect(await membro(duda)).toMatchObject({ pontos: "10.00" });
  });

  it("convite ativado: amizade, protetor para os dois e 20 XP de liga para quem convidou", async () => {
    const eva = await pessoa("Eva");
    const fabio = await pessoa("Fabio", "bronze", eva);
    await concluirManual(fabio, "n1u1d01"); // o 1º desafio ativa o convite, com ou sem câmera
    const convite = await db.query<{ ativado: boolean; recompensado: boolean }>(
      "select ativado_em is not null as ativado, recompensado from public.invites where invitee_id = $1", [fabio]);
    expect(convite.rows[0]).toEqual({ ativado: true, recompensado: true });
    expect(await membro(eva)).toMatchObject({ pontos: "20.00" });
    const amizade = await db.query("select 1 from public.friendships where $1 in (user_a, user_b) and $2 in (user_a, user_b)", [eva, fabio]);
    expect(amizade.rows).toHaveLength(1);
    const protetores = await db.query<{ protetores: number }>(
      "select protetores from public.streaks where user_id in ($1, $2) order by user_id", [eva, fabio]);
    expect(protetores.rows.map((r) => r.protetores)).toEqual([1, 1]);
    await concluir(fabio, "n1u1d02"); // o 2º desafio não ativa de novo
    expect(await membro(eva)).toMatchObject({ pontos: "20.00" });
  });

  it("até 10 convites recompensados com XP por mês", async () => {
    const gil = await pessoa("Gil");
    for (let i = 0; i < 11; i++) await concluirManual(await pessoa(`Amigo do Gil ${i}`, "bronze", gil), "n1u1d01");
    expect(await membro(gil)).toMatchObject({ pontos: "200.00" });
  });
});

describe("fechamento da semana", () => {
  beforeAll(novoBanco);

  it("é proporcional: 15 pessoas, 4 sobem e 3 descem; sobe ganha protetor e a conquista", async () => {
    const g = await grupo("prata", passada, Array.from({ length: 15 }, (_, i) => 200 - i * 10), "Prata");
    await db.query("select public.fechar_ligas()");
    expect(await resultados(g.liga)).toEqual([...Array(4).fill("subiu"), ...Array(8).fill("manteve"), ...Array(3).fill("desceu")]);
    expect(await divisao(g.ids[0])).toBe("ouro");
    expect(await divisao(g.ids[14])).toBe("bronze");
    const protetor = await db.query<{ protetores: number }>("select protetores from public.streaks where user_id = $1", [g.ids[0]]);
    expect(protetor.rows[0].protetores).toBe(1);
    const conquista = await db.query("select 1 from public.user_achievements where user_id = $1 and achievement_id = 'primeira_subida'", [g.ids[0]]);
    expect(conquista.rows).toHaveLength(1);
  });

  it("grupo pequeno: só o 1º sobe; quem fez 0 XP não sobe", async () => {
    const pequeno = await grupo("safira", passada, [50, 40, 30], "Safira");
    const parado = await grupo("safira", passada, [0, 0], "Safira parado");
    await db.query("select public.fechar_ligas()");
    expect(await resultados(pequeno.liga)).toEqual(["subiu", "manteve", "manteve"]);
    expect(await resultados(parado.liga)).toEqual(["manteve", "manteve"]);
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

  it("a virada da semana fecha a passada e monta a nova com todo mundo", async () => {
    const g = await grupo("ouro", passada, [30, 20, 10], "Virada");
    await db.query("select public.liga_virar_semana()");
    expect(await resultados(g.liga)).toEqual(["subiu", "manteve", "manteve"]);
    expect(await membro(g.ids[0])).toMatchObject({ divisao: "safira", pontos: "0.00" });
    expect(await membro(g.ids[2])).toMatchObject({ divisao: "ouro" });
  });

  it("o cliente não chama o fechamento", async () => {
    const ana = await pessoa("Ana cliente");
    await expect(rpc(ana, "public.fechar_ligas()")).rejects.toThrow(/permission denied/);
    await expect(rpc(ana, "public.liga_virar_semana()")).rejects.toThrow(/permission denied/);
  });
});

describe("tela da liga", () => {
  beforeAll(novoBanco);

  it("mostra todo mundo que treinou; quem fez 0 XP vira contagem", async () => {
    const g = await grupo("prata", semana, [100, 90, 80, 70, 0, 0, 0], "Tela");
    const eu = await rpc<{ tamanho: number; sem_treino: number; linhas: { posicao: number; eu: boolean }[] }>(g.ids[3], "public.ler_liga()");
    expect(eu).toMatchObject({ tamanho: 7, sem_treino: 3 });
    expect(eu.linhas.map((l) => l.posicao)).toEqual([1, 2, 3, 4]);
    expect(JSON.stringify(eu)).not.toContain("user_id");
    const parada = await rpc<{ sem_treino: number; zona: string; linhas: { posicao: number; eu: boolean }[] }>(g.ids[6], "public.ler_liga()");
    expect(parada.sem_treino).toBe(2);
    expect(parada.linhas.filter((l) => l.eu)).toHaveLength(1);
    expect(parada.zona).toBe("descida");
  });

  it("mostra quanto falta para subir e para ficar", async () => {
    const g = await grupo("ouro", semana, [100, 90, 80, 70, 60, 50, 40, 30, 20, 10], "Faltam");
    expect(await rpc(g.ids[5], "public.ler_liga()")).toMatchObject({ sobem: 2, zona: "meio", faltam_para_subir: 41 });
    expect(await rpc(g.ids[8], "public.ler_liga()")).toMatchObject({ zona: "descida", faltam_para_ficar: 11 });
  });

  it("mostra o resultado da semana passada", async () => {
    const g = await grupo("bronze", passada, [90, 10, 5, 3, 2], "Volta");
    const tela = await rpc(g.ids[0], "public.ler_liga()");
    expect(tela).toMatchObject({ no_grupo: true, divisao: "prata", semana_passada: { divisao: "bronze", posicao: 1, resultado: "subiu" } });
  });
});

describe("migração: refaz a semana atual", () => {
  it("põe todo mundo num grupo, recalcula os pontos e ativa convites antigos", async () => {
    db = await criarBanco({ ate: "20261120001000" });
    semana = (await db.query<{ s: string }>("select public.liga_semana_inicio()::text as s")).rows[0].s;
    const luan = await pessoa("Luan");
    const regina = await pessoa("Regina");
    const olesia = await pessoa("Olesia", "bronze", luan);
    const bruno = await pessoa("Bruno", "bronze", luan);
    await concluir(luan, "n1u1d01"); // regra antiga: entra na liga com 15
    await concluir(regina, "n1u1d01");
    // Olesia treinou antes da liga existir: sem o gatilho, não pontuou.
    await db.query("alter table public.xp_events disable trigger xp_events_liga");
    await concluir(olesia, "n1u1d01");
    await db.query("alter table public.xp_events enable trigger xp_events_liga");
    await tentativa(regina, "n1u1d08", "manual", 10); // respiração: antes não valia

    await rodarMigracao(db, "20261120001000_liga_todos.sql");

    expect(await tamanhos("bronze")).toEqual([4]);
    expect(await membro(luan)).toMatchObject({ pontos: "35.00" }); // 15 + 20 do convite da Olesia
    expect(await membro(regina)).toMatchObject({ pontos: "25.00" });
    expect(await membro(olesia)).toMatchObject({ pontos: "15.00" });
    expect(await membro(bruno)).toMatchObject({ pontos: "0.00" });
    const convites = await db.query<{ ativado: boolean }>(
      "select ativado_em is not null as ativado from public.invites order by invitee_id = $1", [bruno]);
    expect(convites.rows.map((r) => r.ativado)).toEqual([true, false]);
  });
});

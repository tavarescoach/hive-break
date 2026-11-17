import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

let db: PGlite;

interface Desafio {
  id: string;
  unit_id: string;
  level_id: number;
  ordem: number;
  tipo: string;
  intensidade: string;
  xp: number;
  estado: string;
}
interface Trilha {
  nivel_atual: number;
  ofensiva: number;
  xp_hoje: number;
  meta_xp: number;
  niveis: { id: number; liberado: boolean; concluido: boolean }[];
  unidades: { id: string; level_id: number }[];
  desafios: Desafio[];
  baus_abertos: { unit_id: string; posicao: number }[];
}

/** Usuário com cadastro concluído, como ficaria depois do onboarding. */
async function pessoa(nome: string, liberado = true) {
  const id = await criarUsuario(db, nome);
  await db.query(
    "update public.profiles set apelido = $2, onboarding_concluido_em = now(), liberado_alta_intensidade = $3, meta_desafios_dia = 3 where id = $1",
    [id, nome, liberado],
  );
  await db.query("insert into public.user_level_progress (user_id, level_id, liberado) values ($1, 1, true)", [id]);
  return id;
}

const rpc = <T>(usuario: string | null, sql: string, params: unknown[] = []) =>
  como(db, { usuario }, async (tx) => (await tx.query<{ r: T }>(`select ${sql} as r`, params)).rows[0].r);
const ler = (usuario: string) => rpc<Trilha>(usuario, "public.ler_trilha()");
interface Resultado {
  xp: number; modo: string; sem_movimento: boolean; primeiro_do_dia: boolean; refeito: boolean; refazer_sem_xp: boolean;
  ofensiva: number; unidade_concluida: boolean; unidade_sessao: boolean; nivel_concluido: boolean; proximo_nivel: number | null;
}
/** Blocos como a câmera enviaria: `reps` repetições válidas em cada exercício do desafio. */
const BLOCOS = (reps: number) => `(select jsonb_agg(jsonb_build_object('ordem', ordem, 'reps_validas', ${reps}, 'reps_parciais', 0,
  'tempo_valido_s', 0, 'fora_quadro_pct', 0, 'kpis', '{}'::jsonb)) from public.challenge_blocks where challenge_id = $1)`;
/** Conclui pela câmera, com movimento em todos os exercícios. */
const concluir = (usuario: string, desafio: string) => rpc<Resultado>(usuario, `public.finalizar_desafio($1, 'camera', ${BLOCOS(10)})`, [desafio]);
const concluirManual = (usuario: string, desafio: string) => rpc<Resultado>(usuario, "public.finalizar_desafio($1, 'manual', '[]')", [desafio]);
const estados = (t: Trilha, filtro: (d: Desafio) => boolean) => t.desafios.filter(filtro).map((d) => d.estado);

beforeAll(async () => {
  db = await criarBanco();
});

describe("conteúdo da trilha (seed)", () => {
  it("tem os 19 exercícios, 8 níveis e 3 unidades por nível", async () => {
    const { rows } = await db.query<{ e: number; u: number; por_nivel: number[] }>(
      `select (select count(*)::int from public.exercises) as e, (select count(*)::int from public.units) as u,
              (select array_agg(n order by level_id) from (select level_id, count(*)::int as n from public.units group by 1) x) as por_nivel`);
    expect(rows[0]).toEqual({ e: 19, u: 24, por_nivel: [3, 3, 3, 3, 3, 3, 3, 3] });
  });

  it("cada unidade tem de 8 a 12 desafios (8, 8, 10, 10, 10, 12, 12, 12) mais o desafio da unidade no fim", async () => {
    const { rows } = await db.query<{ level_id: number; desafios: number; finais: number; ultimo: string }>(
      `select c.level_id, count(*) filter (where tipo = 'desafio')::int as desafios, count(*) filter (where tipo = 'final')::int as finais,
              (array_agg(tipo order by ordem desc))[1] as ultimo
       from public.challenges c group by unit_id, c.level_id order by c.level_id`);
    expect(rows).toHaveLength(24);
    for (const r of rows) {
      expect(r.desafios, `nível ${r.level_id}`).toBe([8, 8, 10, 10, 10, 12, 12, 12][r.level_id - 1]);
      expect(r).toMatchObject({ finais: 1, ultimo: "final" });
    }
  });

  it("começa no aquecimento e termina na respiração; cada desafio dura até 5 min e os blocos somam a duração", async () => {
    const ordem = await db.query<{ primeiro: string; penultimo: string }>(
      `select (array_agg(modalidade order by ordem))[1] as primeiro, (array_agg(modalidade order by ordem desc))[2] as penultimo
       from public.challenges group by unit_id`);
    expect(new Set(ordem.rows.map((r) => `${r.primeiro}>${r.penultimo}`))).toEqual(new Set(["aquecimento>respiracao"]));
    const blocos = await db.query<{ id: string }>(
      `select c.id from public.challenges c join public.challenge_blocks b on b.challenge_id = c.id
       group by c.id, c.duracao_s
       having c.duracao_s > 300 or sum((b.parametros_por_dificuldade -> 'padrao' ->> 'segundos')::int) <> c.duracao_s`);
    expect(blocos.rows).toEqual([]);
  });

  it("equipamento segue a seção 6.1: nada até o nível 4, tapete a partir do 5, cabo de vassoura a partir do 7", async () => {
    const { rows } = await db.query<{ level_id: number; itens: string[] | null }>(
      `select level_id, array_agg(distinct equipamento) filter (where equipamento is not null) as itens
       from public.challenges group by level_id order by level_id`);
    expect(rows.map((r) => (r.itens ?? []).sort().join("+"))).toEqual(["", "", "", "", "tapete", "tapete", "cabo_vassoura+tapete", "cabo_vassoura+tapete"]);
  });
});

describe("percorrer a trilha", () => {
  it("começa com só o primeiro desafio do nível 1 disponível", async () => {
    const ana = await pessoa("Ana");
    const t = await ler(ana);
    expect(t).toMatchObject({ nivel_atual: 1, ofensiva: 0, xp_hoje: 0, meta_xp: 30 });
    expect(t.desafios.filter((d) => d.estado === "disponivel").map((d) => d.id)).toEqual(["n1u1d01"]);
    expect(new Set(estados(t, (d) => d.level_id > 1))).toEqual(new Set(["bloqueado"]));
  });

  it("concluir com a câmera dá XP cheio, conta a ofensiva e libera o próximo", async () => {
    const ana = await pessoa("Ana 2");
    expect(await concluir(ana, "n1u1d01")).toMatchObject({ xp: 15, modo: "camera", primeiro_do_dia: true, refeito: false, ofensiva: 1, unidade_concluida: false });
    expect(await concluir(ana, "n1u1d02")).toMatchObject({ xp: 10, primeiro_do_dia: false, ofensiva: 1 });
    const t = await ler(ana);
    expect(t).toMatchObject({ xp_hoje: 25, ofensiva: 1 });
    expect(estados(t, (d) => d.unit_id === "n1u1").slice(0, 4)).toEqual(["concluido", "concluido", "disponivel", "bloqueado"]);
    const blocos = await db.query<{ n: number; reps: number }>(
      `select count(*)::int as n, sum(reps_validas)::int as reps from public.attempt_blocks b
       join public.challenge_attempts a on a.id = b.attempt_id where a.user_id = $1`, [ana]);
    expect(blocos.rows[0]).toEqual({ n: 4, reps: 40 });
  });

  it("refazer dá 1/3 do XP, uma vez por desafio por dia", async () => {
    const ana = await pessoa("Ana refaz");
    await concluir(ana, "n1u1d01");
    expect(await concluir(ana, "n1u1d01")).toMatchObject({ xp: 3, refeito: true, refazer_sem_xp: false });
    expect(await concluir(ana, "n1u1d01")).toMatchObject({ xp: 0, refeito: true, refazer_sem_xp: true });
    // Outro desafio refeito no mesmo dia ainda ganha o seu terço.
    await concluir(ana, "n1u1d02");
    expect(await concluir(ana, "n1u1d02")).toMatchObject({ xp: 3 });
    expect((await ler(ana)).xp_hoje).toBe(15 + 3 + 10 + 3);
    // No dia seguinte, o terço volta a valer (e com o +5 do primeiro do dia).
    await db.query("update public.challenge_attempts set concluido_em = concluido_em - interval '1 day' where user_id = $1", [ana]);
    expect(await concluir(ana, "n1u1d01")).toMatchObject({ xp: 3 + 5, refeito: true, primeiro_do_dia: true });
  });

  it("sem câmera (modo manual) vale metade do XP", async () => {
    const ana = await pessoa("Ana manual");
    expect(await concluirManual(ana, "n1u1d01")).toMatchObject({ xp: 5 + 3, modo: "manual" });
    expect(await concluirManual(ana, "n1u1d02")).toMatchObject({ xp: 5 });
    expect(await concluirManual(ana, "n1u1d02")).toMatchObject({ xp: 2, refeito: true });
    const tentativas = await db.query<{ modo: string; valido_para_liga: boolean }>(
      "select distinct modo, valido_para_liga from public.challenge_attempts where user_id = $1", [ana]);
    expect(tentativas.rows).toEqual([{ modo: "manual", valido_para_liga: false }]);
  });

  it("câmera sem movimento vale como manual; números impossíveis são recusados", async () => {
    const ana = await pessoa("Ana parada");
    const parada = await rpc<Resultado>(ana, `public.finalizar_desafio($1, 'camera', ${BLOCOS(0)})`, ["n1u1d01"]);
    expect(parada).toMatchObject({ modo: "manual", sem_movimento: true, xp: 5 + 3 });
    await expect(rpc(ana, `public.finalizar_desafio($1, 'camera', ${BLOCOS(5000)})`, ["n1u1d02"])).rejects.toThrow(/kpis_invalidos/);
    await expect(rpc(ana, "public.finalizar_desafio('n1u1d02', 'camera', '{}')")).rejects.toThrow(/kpis_invalidos/);
    await expect(rpc(ana, "public.finalizar_desafio('n1u1d02', 'turbo', '[]')")).rejects.toThrow(/modo_invalido/);
    await expect(
      rpc(ana, `public.finalizar_desafio('n1u1d02', 'camera', '[{"ordem": 9, "reps_validas": 3, "kpis": {}}]')`),
    ).rejects.toThrow(/kpis_invalidos/);
  });

  it("não deixa concluir desafio bloqueado nem inexistente", async () => {
    const ana = await pessoa("Ana 3");
    await expect(concluir(ana, "n1u1d05")).rejects.toThrow(/desafio_bloqueado/);
    await expect(concluir(ana, "n2u1d01")).rejects.toThrow(/desafio_bloqueado/);
    await expect(concluir(ana, "nao_existe")).rejects.toThrow(/desafio_inexistente/);
    await expect(rpc(null, "public.finalizar_desafio('n1u1d01', 'manual', '[]')")).rejects.toThrow(/permission denied/);
    await expect(rpc(null, "public.ler_trilha()")).rejects.toThrow(/permission denied/);
  });

  it("baú: abre uma vez, só depois dos 4 desafios, e dá 10 XP", async () => {
    const ana = await pessoa("Ana 4");
    const abrir = (unidade: string, posicao: number) => rpc<{ xp: number }>(ana, "public.abrir_bau($1, $2)", [unidade, posicao]);
    for (const d of ["n1u1d01", "n1u1d02", "n1u1d03"]) await concluir(ana, d);
    await expect(abrir("n1u1", 4)).rejects.toThrow(/bau_bloqueado/);
    await concluir(ana, "n1u1d04");
    expect(await abrir("n1u1", 4)).toEqual({ xp: 10 });
    await expect(abrir("n1u1", 4)).rejects.toThrow(/bau_ja_aberto/);
    await expect(abrir("n1u1", 8)).rejects.toThrow(/bau_bloqueado/);
    await expect(abrir("n1u1", 3)).rejects.toThrow(/bau_inexistente/);
    const t = await ler(ana);
    expect(t.baus_abertos).toEqual([{ unit_id: "n1u1", posicao: 4 }]);
    expect(t.xp_hoje).toBe(15 + 10 * 3 + 10);
    await expect(
      como(db, { usuario: ana }, (tx) => tx.query("insert into public.user_chests (user_id, unit_id, posicao) values ($1, 'n1u1', 8)", [ana])),
    ).rejects.toThrow(/permission denied/);
  });

  it("fechar a unidade numa sessão dá +50 XP; fechar o nível dá +30 e libera a seção seguinte", async () => {
    const ana = await pessoa("Ana 5");
    const nivel1 = (await ler(ana)).desafios.filter((d) => d.level_id === 1);
    expect(nivel1).toHaveLength(27);
    const resultados = [];
    for (const d of nivel1) resultados.push({ id: d.id, ...(await concluir(ana, d.id)) });
    expect(resultados.filter((r) => r.unidade_concluida).map((r) => r.id)).toEqual(["n1u1final", "n1u2final", "n1u3final"]);
    expect(resultados.filter((r) => r.nivel_concluido).map((r) => r.id)).toEqual(["n1u3final"]);
    expect(resultados.filter((r) => r.unidade_sessao).map((r) => r.id)).toEqual(["n1u1final", "n1u2final", "n1u3final"]);
    expect(resultados.find((r) => r.id === "n1u1final")).toMatchObject({ xp: 20 + 50 });
    expect(resultados.at(-1)).toMatchObject({ xp: 20 + 50 + 30, proximo_nivel: 2 });
    const t = await ler(ana);
    expect(t.nivel_atual).toBe(2);
    expect(t.niveis.slice(0, 3).map((n) => [n.liberado, n.concluido])).toEqual([[true, true], [true, false], [false, false]]);
    expect(t.desafios.filter((d) => d.estado === "disponivel").map((d) => d.id)).toEqual(["n2u1d01"]);
    // Refazer um desafio antigo não conclui a unidade de novo.
    expect(await concluir(ana, "n1u1final")).toMatchObject({ xp: 7, unidade_concluida: false, nivel_concluido: false });
  });

  it("unidade feita em dias diferentes não ganha o bônus de sessão única", async () => {
    const ana = await pessoa("Ana aos poucos");
    const unidade = (await ler(ana)).desafios.filter((d) => d.unit_id === "n1u1");
    for (const d of unidade.slice(0, 4)) await concluir(ana, d.id);
    await db.query("update public.user_challenge_progress set concluido_em = concluido_em - interval '2 days' where user_id = $1", [ana]);
    let ultimo: Resultado | null = null;
    for (const d of unidade.slice(4)) ultimo = await concluir(ana, d.id);
    expect(ultimo).toMatchObject({ unidade_concluida: true, unidade_sessao: false, xp: 20 });
  });

  it("'Pular para cá' libera a seção escolhida e muda o nível atual", async () => {
    const ana = await pessoa("Ana 6");
    await como(db, { usuario: ana }, (tx) => tx.query("select public.pular_para_secao(5)"));
    const t = await ler(ana);
    expect(t.nivel_atual).toBe(5);
    expect(t.desafios.filter((d) => d.estado === "disponivel").map((d) => d.id)).toEqual(["n1u1d01", "n5u1d01"]);
    expect(await concluir(ana, "n5u1d01")).toMatchObject({ xp: 15 });
    await expect(como(db, { usuario: ana }, (tx) => tx.query("select public.pular_para_secao(99)"))).rejects.toThrow(/secao_inexistente/);
  });
});

describe("quem está limitado a baixa intensidade (triagem)", () => {
  it("desafios de média e alta intensidade ficam travados, sem segurar a fila", async () => {
    const bia = await pessoa("Bia", false);
    let t = await ler(bia);
    const unidade = t.desafios.filter((d) => d.unit_id === "n1u1");
    expect(unidade.map((d) => `${d.intensidade}:${d.estado}`)).toEqual([
      "baixa:disponivel", "baixa:bloqueado", "media:travado", "media:travado", "alta:travado", "alta:travado",
      "baixa:bloqueado", "baixa:bloqueado", "media:travado",
    ]);
    await expect(concluir(bia, "n1u1d03")).rejects.toThrow(/desafio_bloqueado/);
    await concluir(bia, "n1u1d01");
    await concluir(bia, "n1u1d02");
    // Pula os 4 travados e segue para o yoga.
    t = await ler(bia);
    expect(t.desafios.filter((d) => d.estado === "disponivel").map((d) => d.id)).toEqual(["n1u1d07"]);
    await concluir(bia, "n1u1d07");
    // Fecha a unidade pelos desafios que pode fazer (o desafio final é de intensidade média).
    expect(await concluir(bia, "n1u1d08")).toMatchObject({ unidade_concluida: true, unidade_sessao: true, nivel_concluido: false });
    // Baú depois de 4 itens: liberado porque nada pendente ficou para trás.
    expect(await rpc<{ xp: number }>(bia, "public.abrir_bau('n1u1', 4)")).toEqual({ xp: 10 });

    // Depois de declarar liberação, os travados viram pendentes de novo.
    await db.query("update public.profiles set liberado_alta_intensidade = true where id = $1", [bia]);
    t = await ler(bia);
    expect(t.desafios.filter((d) => d.estado === "disponivel").map((d) => d.id)).toEqual(["n1u1d03"]);
  });
});

describe("ofensiva (versão simples da Fase 1)", () => {
  it("soma dias seguidos, recomeça depois de um dia perdido e mostra zero quando está vencida", async () => {
    const caio = await pessoa("Caio");
    await db.query("update public.streaks set atual = 3, recorde = 5, ultimo_dia_ativo = (now() at time zone 'America/Sao_Paulo')::date - 1 where user_id = $1", [caio]);
    expect((await ler(caio)).ofensiva).toBe(3);
    expect(await concluir(caio, "n1u1d01")).toMatchObject({ ofensiva: 4 });
    expect(await concluir(caio, "n1u1d02")).toMatchObject({ ofensiva: 4 });

    await db.query("update public.streaks set atual = 9, ultimo_dia_ativo = (now() at time zone 'America/Sao_Paulo')::date - 3 where user_id = $1", [caio]);
    expect((await ler(caio)).ofensiva).toBe(0);
    expect(await concluir(caio, "n1u1d03")).toMatchObject({ ofensiva: 1 });
    const { rows } = await db.query<{ recorde: number; dias: number }>(
      "select recorde, (select count(*)::int from public.streak_days where user_id = $1) as dias from public.streaks where user_id = $1", [caio]);
    expect(rows[0]).toEqual({ recorde: 5, dias: 1 });
  });
});

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

let db: PGlite;

interface Participante {
  id: string;
  apelido: string;
  atrasado: boolean;
  concluido: boolean;
  xp: number | null;
  reps: number | null;
}
interface Hive {
  id: string;
  status: "sala" | "andamento" | "encerrada";
  anfitriao: string;
  challenge_id: string;
  modo_competicao: boolean;
  sou_participante: boolean;
  amigo: boolean;
  participantes: Participante[];
  estado_desafio?: string;
}

const rpc = <T>(usuario: string | null, sql: string, params: unknown[] = []) =>
  como(db, { usuario }, async (tx) => (await tx.query<{ r: T }>(`select ${sql} as r`, params)).rows[0].r);
const BLOCOS = (reps: number) => `(select jsonb_agg(jsonb_build_object('ordem', ordem, 'reps_validas', ${reps}, 'reps_parciais', 0,
  'tempo_valido_s', 0, 'fora_quadro_pct', 0, 'kpis', '{}'::jsonb)) from public.challenge_blocks where challenge_id = $1)`;
const concluir = (usuario: string, desafio: string, reps = 10) =>
  rpc<{ xp: number }>(usuario, `public.finalizar_desafio($1, 'camera', ${BLOCOS(reps)})`, [desafio]);

async function pessoa(nome: string, liberado = true) {
  const id = await criarUsuario(db, nome);
  await db.query(
    "update public.profiles set apelido = $2, onboarding_concluido_em = now(), liberado_alta_intensidade = $3 where id = $1",
    [id, nome, liberado],
  );
  await db.query("insert into public.user_level_progress (user_id, level_id, liberado) values ($1, 1, true)", [id]);
  return id;
}

let ana: string;
let bruno: string;
let bia: string;
let hive: string;

beforeAll(async () => {
  db = await criarBanco();
  ana = await pessoa("Ana");
  bruno = await pessoa("Bruno");
  bia = await pessoa("Bia", false);
  // Ana já fez o primeiro desafio; para Bruno o segundo ainda está bloqueado.
  await concluir(ana, "n1u1d01");
});

describe("hive ao vivo", () => {
  it("anfitriã só abre hive de desafio liberado para ela, e uma de cada vez", async () => {
    await expect(rpc(ana, "public.criar_hive('n1u1d05', false)")).rejects.toThrow(/desafio_bloqueado/);
    hive = await rpc<string>(ana, "public.criar_hive('n1u1d02', false)");
    await expect(rpc(ana, "public.criar_hive('n1u1d01', false)")).rejects.toThrow(/hive_ativa/);
    const h = await rpc<Hive>(ana, "public.ler_hive($1)", [hive]);
    expect(h).toMatchObject({ status: "sala", anfitriao: "Ana", challenge_id: "n1u1d02", sou_participante: true, modo_competicao: false });
    expect(h.participantes.map((p) => p.apelido)).toEqual(["Ana"]);
  });

  it("só a anfitriã liga o modo competição", async () => {
    await rpc(bruno, "public.definir_competicao_hive($1, true)", [hive]);
    expect((await rpc<Hive>(ana, "public.ler_hive($1)", [hive])).modo_competicao).toBe(false);
    await rpc(ana, "public.definir_competicao_hive($1, true)", [hive]);
    expect((await rpc<Hive>(ana, "public.ler_hive($1)", [hive])).modo_competicao).toBe(true);
  });

  it("todos veem a hive aberta, mesmo sem ser amigo", async () => {
    const lista = await rpc<Hive[]>(bruno, "public.listar_hives()");
    expect(lista.map((h) => h.id)).toContain(hive);
    expect(lista.find((h) => h.id === hive)).toMatchObject({ amigo: false, sou_participante: false });
  });

  it("join com a hive em andamento entra como atrasado e libera o desafio bloqueado na trilha", async () => {
    await expect(concluir(bruno, "n1u1d02")).rejects.toThrow(/desafio_bloqueado/);
    await rpc(ana, "public.comecar_hive_agora($1)", [hive]);
    expect(await rpc(bruno, "public.entrar_hive($1)", [hive])).toEqual({ challenge_id: "n1u1d02", atrasado: true });
    const h = await rpc<Hive>(bruno, "public.ler_hive($1)", [hive]);
    expect(h).toMatchObject({ status: "andamento", sou_participante: true, estado_desafio: "bloqueado" });
    expect(h.participantes.find((p) => p.apelido === "Bruno")).toMatchObject({ atrasado: true });
    expect((await concluir(bruno, "n1u1d02", 12)).xp).toBeGreaterThan(0);
  });

  it("quem está travado pela triagem não entra", async () => {
    const travada = await rpc<string>(bruno, "public.criar_hive('n1u1d01', false)");
    await db.query("update public.hives set challenge_id = 'n1u1d03' where id = $1", [travada]);
    await expect(rpc(bia, "public.entrar_hive($1)", [travada])).rejects.toThrow(/desafio_travado/);
  });

  it("o card coletivo usa os números gravados pelo servidor", async () => {
    await concluir(ana, "n1u1d02", 9);
    expect(await rpc(ana, "public.registrar_resultado_hive($1)", [hive])).toBe(true);
    expect(await rpc(bruno, "public.registrar_resultado_hive($1)", [hive])).toBe(true);
    expect(await rpc(bia, "public.registrar_resultado_hive($1)", [hive])).toBe(false);
    const h = await rpc<Hive>(bia, "public.ler_hive($1)", [hive]);
    const porNome = Object.fromEntries(h.participantes.map((p) => [p.apelido, p]));
    expect(porNome.Ana).toMatchObject({ concluido: true });
    expect(porNome.Bruno).toMatchObject({ concluido: true });
    expect(porNome.Bruno.reps).toBeGreaterThan(porNome.Ana.reps ?? 0);
  });

  it("o cliente não escreve direto nas tabelas da hive", async () => {
    await expect(
      como(db, { usuario: bia }, (tx) => tx.query("insert into public.hives (anfitriao_id, challenge_id, inicio_em, fim_em) values ($1, 'n1u1d01', now(), now() + interval '1 hour')", [bia])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      como(db, { usuario: bia }, (tx) => tx.query("update public.hive_participantes set xp = 999")),
    ).rejects.toThrow(/permission denied/);
  });
});

// ---------------------------------------------------------------------------
// Bônus por tamanho da hive e bônus de hive completa (docs/BONUS_HIVE.md, seção 9)
// ---------------------------------------------------------------------------
const blocosComFora = (reps: number, foraPct: number) =>
  `(select jsonb_agg(jsonb_build_object('ordem', ordem, 'reps_validas', ${reps}, 'reps_parciais', 0,
    'tempo_valido_s', 0, 'fora_quadro_pct', ${foraPct}, 'kpis', '{}'::jsonb)) from public.challenge_blocks where challenge_id = $1)`;
const concluirComFora = (usuario: string, desafio: string, foraPct: number) =>
  rpc<{ xp: number }>(usuario, `public.finalizar_desafio($1, 'camera', ${blocosComFora(10, foraPct)})`, [desafio]);
const concluirManual = (usuario: string, desafio: string) =>
  rpc<{ xp: number }>(usuario, "public.finalizar_desafio($1, 'manual', '[]'::jsonb)", [desafio]);
const concluirERegistrar = async (usuario: string, hiveId: string, desafio: string) => {
  await concluir(usuario, desafio);
  return rpc<boolean>(usuario, "public.registrar_resultado_hive($1)", [hiveId]);
};

interface LinhaParticipante {
  status: string;
  xp: number | null;
  xp_base: number | null;
  xp_bonus_tamanho: number;
  xp_bonus_completa: number;
  bonus_contou_no_dia: boolean;
}
async function linhaParticipante(hiveId: string, userId: string): Promise<LinhaParticipante> {
  const { rows } = await db.query<LinhaParticipante>(
    "select status, xp, xp_base, xp_bonus_tamanho, xp_bonus_completa, bonus_contou_no_dia from public.hive_participantes where hive_id = $1 and user_id = $2",
    [hiveId, userId],
  );
  return rows[0];
}
interface LinhaHive {
  n_concluiram: number;
  bonus_tamanho_pct: number;
  completa: boolean;
  janela_ate: string | null;
  fechada_em: string | null;
}
async function linhaHive(hiveId: string): Promise<LinhaHive> {
  const { rows } = await db.query<LinhaHive>(
    "select n_concluiram, bonus_tamanho_pct, completa, janela_ate, fechada_em from public.hives where id = $1",
    [hiveId],
  );
  return rows[0];
}
/** Pula a sala de espera de 60 s: põe a hive em andamento desde já. */
const comecarAgora = (hiveId: string) => db.query("update public.hives set inicio_em = now() - interval '1 second' where id = $1", [hiveId]);
/** Põe a hive "no fim do relógio" sem esperar a duração real (pra abrir a janela de resgate na hora). */
const forcarFimDaHive = (hiveId: string) =>
  db.query("update public.hives set inicio_em = now() - interval '1 hour', fim_em = now() - interval '1 second' where id = $1", [hiveId]);

describe("bônus de hive (docs/BONUS_HIVE.md)", () => {
  it("hive de 3 com todos concluindo: só o bônus de tamanho (+18%), sem completa", async () => {
    const host = await pessoa("Dalva");
    const b = await pessoa("Elton");
    const c = await pessoa("Fabia");
    const hive = await rpc<string>(host, "public.criar_hive('n1u1d01', false)");
    await rpc(b, "public.entrar_hive($1)", [hive]);
    await rpc(c, "public.entrar_hive($1)", [hive]);
    await comecarAgora(hive);

    expect(await concluirERegistrar(host, hive, "n1u1d01")).toBe(true);
    expect(await concluirERegistrar(b, hive, "n1u1d01")).toBe(true);
    expect(await concluirERegistrar(c, hive, "n1u1d01")).toBe(true);

    const h = await linhaHive(hive);
    expect(h).toMatchObject({ n_concluiram: 3, bonus_tamanho_pct: 18, completa: false });
    expect(h.fechada_em).not.toBeNull();
    const lp = await linhaParticipante(hive, host);
    expect(lp.xp_bonus_completa).toBe(0);
    expect(lp.xp_bonus_tamanho).toBe(Math.round((lp.xp_base ?? 0) * 0.18));
    expect(lp.xp).toBe((lp.xp_base ?? 0) + lp.xp_bonus_tamanho);
  });

  it("hive de 5 com 1 'parei por dor': completa conta com 4 → +23% + 20%", async () => {
    const host = await pessoa("Gustavo");
    const outros = [await pessoa("Helena"), await pessoa("Igor"), await pessoa("Julia")];
    const desistente = await pessoa("Kleber");
    const hive = await rpc<string>(host, "public.criar_hive('n1u1d01', false)");
    await rpc(desistente, "public.entrar_hive($1)", [hive]);
    for (const u of outros) await rpc(u, "public.entrar_hive($1)", [hive]);
    expect(await rpc(desistente, "public.hive_parar_justificado($1, $2)", [hive, "dor"])).toBe(true);
    await comecarAgora(hive);

    expect(await concluirERegistrar(host, hive, "n1u1d01")).toBe(true);
    for (const u of outros) expect(await concluirERegistrar(u, hive, "n1u1d01")).toBe(true);

    const h = await linhaHive(hive);
    expect(h).toMatchObject({ n_concluiram: 4, bonus_tamanho_pct: 23, completa: true });
    expect(h.fechada_em).not.toBeNull();
    const lpHost = await linhaParticipante(hive, host);
    expect(lpHost.xp_bonus_tamanho).toBe(Math.round((lpHost.xp_base ?? 0) * 0.23));
    expect(lpHost.xp_bonus_completa).toBe(Math.round((lpHost.xp_base ?? 0) * 0.2));
    const lpDesistente = await linhaParticipante(hive, desistente);
    expect(lpDesistente).toMatchObject({ status: "parou_justificado", xp_bonus_tamanho: 0, xp_bonus_completa: 0 });
  });

  it("hive de 5 com 1 abandono: sem completa; concluindo na janela, vira completa (+27% + 20%)", async () => {
    const host = await pessoa("Lucia");
    const outros = [await pessoa("Marcio"), await pessoa("Nadia"), await pessoa("Otavio")];
    const retardatario = await pessoa("Paula");
    const hive = await rpc<string>(host, "public.criar_hive('n1u1d01', false)");
    await rpc(retardatario, "public.entrar_hive($1)", [hive]);
    for (const u of outros) await rpc(u, "public.entrar_hive($1)", [hive]);
    // Só agora força o relógio da hive pro passado (todo mundo já entrou).
    await forcarFimDaHive(hive);

    await concluir(host, "n1u1d01");
    expect(await rpc(host, "public.registrar_resultado_hive($1)", [hive])).toBe(true);
    for (const u of outros) {
      await concluir(u, "n1u1d01");
      expect(await rpc(u, "public.registrar_resultado_hive($1)", [hive])).toBe(true);
    }

    // Só 4 de 5 concluíram: abre a janela de resgate, sem fechar.
    let h = await linhaHive(hive);
    expect(h).toMatchObject({ n_concluiram: 4, bonus_tamanho_pct: 23, completa: false, fechada_em: null });
    expect(h.janela_ate).not.toBeNull();

    // O retardatário refaz dentro da janela: a hive vira completa na hora.
    await concluir(retardatario, "n1u1d01");
    expect(await rpc(retardatario, "public.registrar_resultado_hive($1)", [hive])).toBe(true);

    h = await linhaHive(hive);
    expect(h).toMatchObject({ n_concluiram: 5, bonus_tamanho_pct: 27, completa: true });
    expect(h.fechada_em).not.toBeNull();
    const lp = await linhaParticipante(hive, retardatario);
    expect(lp.xp_bonus_tamanho).toBe(Math.round((lp.xp_base ?? 0) * 0.27));
    expect(lp.xp_bonus_completa).toBe(Math.round((lp.xp_base ?? 0) * 0.2));
  });

  it("4ª hive do dia da mesma pessoa: só XP base, sem bônus", async () => {
    const testador = await pessoa("Quiteria");
    const desafios = ["n1u1d01", "n1u1d02", "n1u1d03", "n1u1d04"];
    let ultimaHive = "";
    for (const [i, desafio] of desafios.entries()) {
      const parceiro = await pessoa(`Parceiro${i}`);
      const hive = await rpc<string>(testador, `public.criar_hive('${desafio}', false)`);
      await rpc(parceiro, "public.entrar_hive($1)", [hive]);
      await comecarAgora(hive);
      expect(await concluirERegistrar(testador, hive, desafio)).toBe(true);
      expect(await concluirERegistrar(parceiro, hive, desafio)).toBe(true);
      ultimaHive = hive;
      if (i < desafios.length - 1) await forcarFimDaHive(hive); // libera o testador pra hospedar a próxima.
      if (i === desafios.length - 1) {
        const lpParceiro = await linhaParticipante(hive, parceiro);
        expect(lpParceiro.xp_bonus_tamanho).toBeGreaterThan(0); // o parceiro nunca teve bônus hoje: conta normal.
      }
    }
    const h = await linhaHive(ultimaHive);
    expect(h.bonus_tamanho_pct).toBeGreaterThan(0); // a hive teve tamanho suficiente pra render bônus...
    const lp = await linhaParticipante(ultimaHive, testador);
    expect(lp).toMatchObject({ xp_bonus_tamanho: 0, xp_bonus_completa: 0, bonus_contou_no_dia: false }); // ...mas não pra quem já usou as 3 vagas do dia.
    expect(lp.xp).toBe(lp.xp_base);
  });

  it("modo manual e mais de 30% fora do quadro não contam para o bônus", async () => {
    const hostManual = await pessoa("Renato");
    const semCamera = await pessoa("Sueli");
    const hiveManual = await rpc<string>(hostManual, "public.criar_hive('n1u1d01', false)");
    await rpc(semCamera, "public.entrar_hive($1)", [hiveManual]);
    await comecarAgora(hiveManual);
    await concluir(hostManual, "n1u1d01");
    await rpc(hostManual, "public.registrar_resultado_hive($1)", [hiveManual]);
    await concluirManual(semCamera, "n1u1d01");
    await rpc(semCamera, "public.registrar_resultado_hive($1)", [hiveManual]);
    expect(await linhaHive(hiveManual)).toMatchObject({ n_concluiram: 1, bonus_tamanho_pct: 0 });

    const hostForaDoQuadro = await pessoa("Tulio");
    const foraDoQuadro = await pessoa("Vanessa");
    const hiveFora = await rpc<string>(hostForaDoQuadro, "public.criar_hive('n1u1d01', false)");
    await rpc(foraDoQuadro, "public.entrar_hive($1)", [hiveFora]);
    await comecarAgora(hiveFora);
    await concluir(hostForaDoQuadro, "n1u1d01");
    await rpc(hostForaDoQuadro, "public.registrar_resultado_hive($1)", [hiveFora]);
    await concluirComFora(foraDoQuadro, "n1u1d01", 50);
    await rpc(foraDoQuadro, "public.registrar_resultado_hive($1)", [hiveFora]);
    expect(await linhaHive(hiveFora)).toMatchObject({ n_concluiram: 1, bonus_tamanho_pct: 0 });
  });
});

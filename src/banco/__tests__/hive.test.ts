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

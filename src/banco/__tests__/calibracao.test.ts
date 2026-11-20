import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { como, criarBanco, criarUsuario } from "../banco-de-teste";

let db: PGlite;
let admin: string;
let aluno: string;

beforeAll(async () => {
  db = await criarBanco();
  admin = await criarUsuario(db, "Luan calibra");
  aluno = await criarUsuario(db, "Aluno curioso");
  await db.query("update public.lembretes_config set valor = $1 where chave = 'ADMINS'", [JSON.stringify([admin])]);
});

const SERIE = {
  exercicio_id: "agachamento_livre", tipo: "reps", pessoa: "A1", app_reps: 11, prof_reps: 12,
  duracao_s: 40, fps_medio: 24.5, posicao_celular: "chão, de frente", serie_temporal: [[0, 170.2], [100, 150.1]],
};

const registrar = (usuario: string | null, p: unknown) =>
  como(db, { usuario }, (tx) => tx.query<{ id: number }>("select public.calibracao_registrar($1) as id", [JSON.stringify(p)]));
const listar = (usuario: string | null) =>
  como(db, { usuario }, (tx) => tx.query<{ lista: Record<string, unknown>[] }>("select public.calibracao_listar() as lista"));

describe("calibração (Etapa C)", () => {
  it("admin grava uma série e lê a lista, sem a série temporal", async () => {
    const { rows } = await registrar(admin, SERIE);
    expect(rows[0].id).toBeGreaterThan(0);
    const { rows: [{ lista }] } = await listar(admin);
    expect(lista[0]).toMatchObject({ exercicio_id: "agachamento_livre", pessoa: "A1", app_reps: 11, prof_reps: 12, tipo: "reps" });
    expect(lista[0]).not.toHaveProperty("serie_temporal");
    const { rows: [gravada] } = await db.query<{ serie_temporal: unknown; admin_id: string }>(
      "select serie_temporal, admin_id from public.calibracao_series where id = $1", [rows[0].id]);
    expect(gravada).toEqual({ serie_temporal: [[0, 170.2], [100, 150.1]], admin_id: admin });
  });

  it("quem não é admin não grava, não lê e não apaga", async () => {
    await expect(registrar(aluno, SERIE)).rejects.toThrow(/sem_permissao/);
    await expect(listar(aluno)).rejects.toThrow(/sem_permissao/);
    await expect(como(db, { usuario: aluno }, (tx) => tx.query("select public.calibracao_apagar(1)"))).rejects.toThrow(/sem_permissao/);
    await expect(registrar(null, SERIE)).rejects.toThrow(/permission denied/);
  });

  it("ninguém lê a tabela direto", async () => {
    await expect(como(db, { usuario: admin }, (tx) => tx.query("select * from public.calibracao_series"))).rejects.toThrow(/permission denied/);
  });

  it("recusa dados fora do formato (tipo, rótulo longo, reps impossíveis)", async () => {
    await expect(registrar(admin, { ...SERIE, tipo: "outro" })).rejects.toThrow(/check/);
    await expect(registrar(admin, { ...SERIE, pessoa: "Nome Completo Muito Comprido Demais" })).rejects.toThrow(/check/);
    await expect(registrar(admin, { ...SERIE, app_reps: 5000 })).rejects.toThrow(/check/);
  });

  it("admin apaga uma série gravada por engano", async () => {
    const { rows } = await registrar(admin, { ...SERIE, pessoa: "engano" });
    await como(db, { usuario: admin }, (tx) => tx.query("select public.calibracao_apagar($1)", [rows[0].id]));
    const { rows: [{ lista }] } = await listar(admin);
    expect(lista.some((s) => s.pessoa === "engano")).toBe(false);
  });
});

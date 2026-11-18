import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- script .mjs sem tipos
import { juntarSql } from "../../../scripts/juntar-sql.mjs";

const ARQUIVO = path.resolve(process.cwd(), "supabase", "instalar.sql");

describe("supabase/instalar.sql", () => {
  it("está em dia com as migrações (rode npm run sql se falhar)", () => {
    expect(readFileSync(ARQUIVO, "utf8")).toBe(juntarSql());
  });

  it("roda de uma vez num banco vazio", async () => {
    const db = new PGlite({ extensions: { pgcrypto, pg_trgm, unaccent } });
    await db.exec(`
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    `);
    await db.exec(readFileSync(ARQUIVO, "utf8"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.levels");
    expect(rows[0].n).toBe(8);
  });
});

/**
 * Banco de teste: um Postgres embutido (PGlite) com as migrações reais de
 * supabase/migrations. Usado pelos testes de RLS e pelo servidor Supabase
 * falso dos testes de ponta a ponta. Não é usado pelo app.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const PASTA_SUPABASE = path.resolve(process.cwd(), "supabase");

/** O mínimo do ambiente Supabase de que as migrações dependem. */
const AMBIENTE_SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- Igual ao Supabase: por padrão tudo é concedido, e as migrações é que restringem.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function criarBanco(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(AMBIENTE_SUPABASE);
  const pasta = path.join(PASTA_SUPABASE, "migrations");
  for (const arquivo of readdirSync(pasta).sort()) {
    if (!arquivo.endsWith(".sql")) continue;
    try {
      await db.exec(readFileSync(path.join(pasta, arquivo), "utf8"));
    } catch (erro) {
      throw new Error(`Migração ${arquivo} falhou: ${(erro as Error).message}`);
    }
  }
  for (const seed of ["seed.sql", "seed_trilha.sql"]) {
    await db.exec(readFileSync(path.join(PASTA_SUPABASE, seed), "utf8"));
  }
  return db;
}

export interface Papel {
  /** id do usuário autenticado; null = visitante (anon). */
  usuario: string | null;
}

/**
 * Roda consultas como o cliente rodaria: no papel `authenticated` (ou `anon`)
 * e com o id do usuário no JWT, dentro de uma transação.
 */
export async function como<T>(db: PGlite, papel: Papel, fn: (tx: Consulta) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = papel.usuario ? { sub: papel.usuario, role: "authenticated" } : { role: "anon" };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(`set local role ${papel.usuario ? "authenticated" : "anon"}`);
    return fn({ query: (sql, params) => tx.query(sql, params) });
  }) as Promise<T>;
}

export interface Consulta {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[]; affectedRows?: number }>;
}

/** Cria um usuário como o Supabase Auth criaria (dispara o gatilho de perfil). */
export async function criarUsuario(db: PGlite, nome: string, email = `${nome.toLowerCase().replace(/\s+/g, ".")}@exemplo.com`) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify({ full_name: nome, avatar_url: `https://exemplo.com/${encodeURIComponent(nome)}.png` })],
  );
  return rows[0].id;
}

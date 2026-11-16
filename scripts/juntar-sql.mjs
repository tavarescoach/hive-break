// Junta as migrações e o seed num arquivo só (supabase/instalar.sql), para a
// primeira instalação pelo SQL Editor do Supabase. Rode com: npm run sql
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const supabase = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase");

export function juntarSql() {
  const pasta = path.join(supabase, "migrations");
  const partes = readdirSync(pasta)
    .filter((nome) => nome.endsWith(".sql"))
    .sort()
    .map((nome) => `-- >>> migrations/${nome}\n${readFileSync(path.join(pasta, nome), "utf8").trim()}\n`);
  partes.push(`-- >>> seed.sql\n${readFileSync(path.join(supabase, "seed.sql"), "utf8").trim()}\n`);
  return [
    "-- Hive Break · instalação inicial do banco (Fase 1).",
    "-- GERADO por scripts/juntar-sql.mjs: não edite. Cole inteiro no SQL Editor do",
    "-- Supabase, num projeto novo, e clique em Run. Só pode ser rodado uma vez.",
    "",
    "begin;",
    "",
    ...partes,
    "commit;",
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(supabase, "instalar.sql"), juntarSql());
  console.log("supabase/instalar.sql atualizado");
}

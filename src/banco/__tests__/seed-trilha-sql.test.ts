import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gerarSqlTrilha } from "../../../scripts/gerar-sql-trilha";

const ARQUIVO = path.resolve(process.cwd(), "supabase", "seed_trilha.sql");

describe("supabase/seed_trilha.sql", () => {
  it("está em dia com content/trilhas/principal.json (rode npm run seed:sql se falhar)", () => {
    expect(readFileSync(ARQUIVO, "utf8")).toBe(gerarSqlTrilha());
  });
});

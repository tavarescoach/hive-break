// Hive Break · Gera supabase/seed_trilha.sql a partir de content/trilhas/principal.json
// (Etapa 1B do docs/PLANO_ETAPAS_UX.md: "a fonte da trilha passa a ser JSON").
// Rode com: npm run seed:sql
//
// A definição de cada exercício (coluna `definicao`, lida pelo motor) continua
// vindo direto de src/exercicios/<id>.json — é esse arquivo, não este script,
// que é a fonte de verdade do que a câmera valida. Só a trilha (unidades,
// desafios, blocos) vem do JSON congelado.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TrilhaPrincipalJson } from "./congelar-trilha";

const raiz = path.resolve(__dirname, "..");
const txt = (valor: string | null) => (valor === null ? "null" : `'${valor.replace(/'/g, "''")}'`);

function lerTrilha(): TrilhaPrincipalJson {
  return JSON.parse(readFileSync(path.join(raiz, "content", "trilhas", "principal.json"), "utf8")) as TrilhaPrincipalJson;
}

export function gerarSqlTrilha(): string {
  const trilha = lerTrilha();
  const linhas: string[] = [
    "-- Hive Break · Seed da trilha: exercícios, unidades, desafios e blocos.",
    "-- GERADO por scripts/gerar-sql-trilha.ts a partir de content/trilhas/principal.json:",
    "-- não edite à mão. Pode ser rodado mais de uma vez (atualiza o que já existe).",
    "-- Precisa da migração 0009 (coluna estrutura).",
    "",
    "insert into public.exercises (id, nome, modalidade, camera, definicao, equipamento) values",
  ];
  linhas.push(
    trilha.exercicios
      .map((e) => {
        const definicao = JSON.stringify(JSON.parse(readFileSync(path.join(raiz, "src", "exercicios", `${e.id}.json`), "utf8")));
        return `  (${txt(e.id)}, ${txt(e.nome)}, ${txt(e.modalidade)}, ${txt(e.camera)}, ${txt(definicao)}::jsonb, ${txt(e.equipamento)})`;
      })
      .join(",\n") +
      "\non conflict (id) do update set nome = excluded.nome, modalidade = excluded.modalidade, camera = excluded.camera,\n  definicao = excluded.definicao, equipamento = excluded.equipamento;",
    "",
  );

  linhas.push(
    "insert into public.units (id, level_id, ordem, titulo, descricao) values",
    trilha.unidades.map((u) => `  (${txt(u.id)}, ${u.levelId}, ${u.ordem}, ${txt(u.titulo)}, ${txt(u.descricao)})`).join(",\n") +
      "\non conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, ordem = excluded.ordem;",
    "",
    "insert into public.challenges (id, level_id, unit_id, ordem, titulo, modalidade, duracao_s, intensidade, equipamento, opcional_em_8, extra_em_12, tipo, metodo, estrutura) values",
    trilha.desafios
      .map(
        (d) =>
          `  (${txt(d.id)}, ${d.levelId}, ${txt(d.unitId)}, ${d.ordem}, ${txt(d.titulo)}, ${txt(d.modalidade)}, ${d.duracaoS}, ${txt(d.intensidade)}, ${txt(d.equipamento)}, ${d.opcionalEm8}, ${d.extraEm12}, ${txt(d.tipo)}, null, ${txt(JSON.stringify(d.estrutura))}::jsonb)`,
      )
      .join(",\n") +
      "\non conflict (id) do update set ordem = excluded.ordem, titulo = excluded.titulo, modalidade = excluded.modalidade,\n  duracao_s = excluded.duracao_s, intensidade = excluded.intensidade, equipamento = excluded.equipamento, tipo = excluded.tipo,\n  metodo = excluded.metodo, estrutura = excluded.estrutura;",
    "",
    "insert into public.challenge_blocks (id, challenge_id, ordem, exercise_id, formato, series, parametros_por_dificuldade, descanso_s) values",
    trilha.blocos
      .map(
        (b) =>
          `  (${txt(b.id)}, ${txt(b.challengeId)}, ${b.ordem}, ${txt(b.exerciseId)}, ${txt(b.formato)}, ${b.series}, ${txt(JSON.stringify({ padrao: { segundos: b.segundos } }))}::jsonb, ${b.descansoS})`,
      )
      .join(",\n") +
      "\non conflict (id) do update set exercise_id = excluded.exercise_id, formato = excluded.formato, series = excluded.series,\n  parametros_por_dificuldade = excluded.parametros_por_dificuldade, descanso_s = excluded.descanso_s;\n\n-- Blocos que sobraram de versões antigas do conteúdo.\ndelete from public.challenge_blocks b using public.challenges c\nwhere b.challenge_id = c.id and c.estrutura is not null and b.ordem > jsonb_array_length(c.estrutura -> 'blocos')\n  and not exists (select 1 from public.attempt_blocks ab where ab.challenge_block_id = b.id);",
    "",
  );
  return linhas.join("\n");
}

if (require.main === module) {
  writeFileSync(path.join(raiz, "supabase", "seed_trilha.sql"), gerarSqlTrilha());
  console.log("supabase/seed_trilha.sql atualizado (a partir de content/trilhas/principal.json)");
}

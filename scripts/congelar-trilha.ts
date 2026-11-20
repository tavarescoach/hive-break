// Hive Break · Congela a trilha gerada hoje por scripts/gerar-seed-trilha.ts em
// content/trilhas/principal.json (Etapa 1B do docs/PLANO_ETAPAS_UX.md, item 0:
// "a fonte da trilha passa a ser JSON ... converta uma vez a saída atual").
//
// Depois de rodar isto, quem gera supabase/seed_trilha.sql é
// scripts/gerar-sql-trilha.ts, lendo este JSON (não mais o algoritmo de
// gerar-seed-trilha.ts, que fica como ferramenta histórica/manual). Roda uma
// vez; o resultado é commitado.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { conteudoTrilha, EXERCICIOS, UNIDADES } from "./gerar-seed-trilha";

const raiz = path.resolve(__dirname, "..");

export interface TrilhaPrincipalJson {
  versao: 1;
  exercicios: { id: string; nome: string; modalidade: string; camera: "frontal" | "lateral"; equipamento: string | null }[];
  unidades: { id: string; levelId: number; ordem: number; titulo: string; descricao: string }[];
  desafios: {
    id: string;
    levelId: number;
    unitId: string;
    ordem: number;
    titulo: string;
    modalidade: string;
    duracaoS: number;
    intensidade: string;
    equipamento: string | null;
    opcionalEm8: boolean;
    extraEm12: boolean;
    tipo: "desafio" | "final";
    estrutura: unknown;
  }[];
  blocos: {
    id: string;
    challengeId: string;
    ordem: number;
    exerciseId: string;
    formato: string;
    series: number;
    segundos: number;
    descansoS: number;
  }[];
}

export function congelarTrilha(): TrilhaPrincipalJson {
  const unidades: TrilhaPrincipalJson["unidades"] = [];
  for (const nivel of Object.keys(UNIDADES).map(Number)) {
    UNIDADES[nivel].forEach(([titulo, descricao], iu) => {
      unidades.push({ id: `n${nivel}u${iu + 1}`, levelId: nivel, ordem: iu + 1, titulo, descricao });
    });
  }

  const desafios: TrilhaPrincipalJson["desafios"] = [];
  const blocos: TrilhaPrincipalJson["blocos"] = [];
  for (const d of conteudoTrilha()) {
    const p = d.posicao;
    desafios.push({
      id: d.id, levelId: d.nivel, unitId: d.unidade, ordem: d.ordem, titulo: p.titulo, modalidade: p.modalidade,
      duracaoS: d.duracaoS, intensidade: p.intensidade, equipamento: d.equipamento,
      opcionalEm8: !!p.opcionalEm8, extraEm12: !!p.extraEm12, tipo: d.tipo, estrutura: d.estrutura,
    });
    d.estrutura.blocos.forEach((bl, ib) => {
      const e = d.exercicios[ib];
      const formato = bl.metodo === "tabata" ? "intervalado" : bl.metodo === "amrap" ? "amrap" : bl.metodo === "isometria" ? e.formato : "repeticoes";
      blocos.push({
        id: `${d.id}b${ib + 1}`, challengeId: d.id, ordem: ib + 1, exerciseId: e.id, formato,
        series: bl.series, segundos: d.segundosPorBloco[ib], descansoS: bl.pausa_s,
      });
    });
  }

  return {
    versao: 1,
    exercicios: EXERCICIOS.map((e) => ({ id: e.id, nome: e.nome, modalidade: e.modalidade, camera: e.camera, equipamento: e.equipamento })),
    unidades,
    desafios,
    blocos,
  };
}

if (require.main === module) {
  writeFileSync(path.join(raiz, "content", "trilhas", "principal.json"), `${JSON.stringify(congelarTrilha(), null, 2)}\n`);
  console.log("content/trilhas/principal.json atualizado");
}

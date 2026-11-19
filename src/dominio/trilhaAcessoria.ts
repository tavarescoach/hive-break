/**
 * Trilhas acessórias (Hive Office, Hive Coluna em Dia, Hive Heat, Hive
 * Desacelerar): personagens ao lado do caminho principal, cada um com um
 * punhado de "hives" (desafios de um exercício só — ver supabase/migrations/
 * 20261125000100_trilhas_acessorias.sql e supabase/seed_trilha_acessoria.sql).
 *
 * O que depende do usuário (estado de cada hive) vem de ler_trilhas_acessorias();
 * o resto (nome, cor, frase, regras...) é conteúdo fixo, guardado aqui, no
 * mesmo espírito de ROTULO_MODALIDADE em trilha.ts.
 */

import type { DesafioTrilha } from "./trilha";

/** Mesmo formato de ler_trilha().desafios[i] — ler_trilhas_acessorias() devolve igual. */
export type HiveAcessoriaBanco = DesafioTrilha;

export type IdTrilhaAcessoria = "office" | "coluna" | "heat" | "desacelerar";

export interface InfoTrilhaAcessoria {
  id: IdTrilhaAcessoria;
  /** id em public.levels (categoria 'acessoria'). */
  levelId: number;
  nome: string;
  frase: string;
  /** Cor de acento da trilha (borda e sombra do hexágono). */
  cor: string;
  corSombra: string;
  intensidadeLabel: string;
  /** Barras preenchidas do medidor de intensidade (1 a 3). */
  barras: 1 | 2 | 3;
  tempoPorHive: string;
  material: string;
  opcional?: string;
  regras: string[];
  camera: string;
  ciencia?: string;
  aviso?: string;
  momento: string;
  /** Hive Heat: id da hive com salto → id da hive "sem impacto" equivalente. */
  semImpacto?: Record<string, string>;
}

export const TRILHAS_ACESSORIAS: InfoTrilhaAcessoria[] = [
  {
    id: "office",
    levelId: 101,
    nome: "Hive Office",
    frase: "Mexa o corpo sem sair da mesa nem suar.",
    cor: "#FFC42E",
    corSombra: "#C99A1F",
    intensidadeLabel: "Leve",
    barras: 1,
    tempoPorHive: "~3 min",
    material: "Nenhum",
    regras: ["Sem salto", "Sem chão", "Roupa social"],
    camera: "Sentado ou em pé, de frente",
    momento: "Entre reuniões",
  },
  {
    id: "coluna",
    levelId: 102,
    nome: "Hive Coluna em Dia",
    frase: "Fortalece e solta lombar, pescoço, ombro e punho.",
    cor: "#5ED1B8",
    corSombra: "#2E9C8A",
    intensidadeLabel: "Moderada",
    barras: 2,
    tempoPorHive: "~4 min",
    material: "Nenhum",
    opcional: "Opcional: tapete",
    regras: ["Pode ir ao chão"],
    camera: "Em pé de frente ou no chão, de lado",
    ciencia: "Exercícios de fortalecimento e alongamento reduzem o risco de dor lombar.",
    aviso: "Dor forte ou que não passa? Procure um profissional.",
    momento: "Qualquer hora",
  },
  {
    id: "heat",
    levelId: 103,
    nome: "Hive Heat",
    frase: "Coração acelerado em poucos minutos.",
    cor: "#FF7A59",
    corSombra: "#C9573D",
    intensidadeLabel: "Intensa",
    barras: 3,
    tempoPorHive: "~5 min",
    material: "Nenhum",
    regras: ["Vai suar"],
    camera: "Em pé, de frente",
    momento: "Vai suar",
    // Troca polichinelo, skipping e toque nos alvos por marcha estacionária.
    semImpacto: { ha_heat_1: "ha_heatalt_1", ha_heat_3: "ha_heatalt_2", ha_heat_7: "ha_heatalt_3" },
  },
  {
    id: "desacelerar",
    levelId: 104,
    nome: "Hive Desacelerar",
    frase: "Solta o corpo e baixa o ritmo pra fechar o dia.",
    cor: "#9AA8FF",
    corSombra: "#6C79C9",
    intensidadeLabel: "Muito leve",
    barras: 1,
    tempoPorHive: "~4 min",
    material: "Nenhum",
    opcional: "Opcional: tapete",
    regras: ["Sessão guiada", "Melhor à noite"],
    camera: "Opcional, guiada por tempo",
    momento: "Antes de dormir",
  },
];

export interface TrilhaAcessoriaMontada extends InfoTrilhaAcessoria {
  hives: HiveAcessoriaBanco[];
  progresso: number;
  total: number;
  /** Primeira hive não concluída (o que "Let's hive" abre), ou null se já fez todas. */
  proxima: HiveAcessoriaBanco | null;
  /** Até 4 títulos de exercício para o resumo do popup. */
  exerciciosPreview: string[];
  maisExercicios: number;
}

/** Junta o conteúdo fixo (TRILHAS_ACESSORIAS) com as hives de ler_trilhas_acessorias(). */
export function montarTrilhasAcessorias(hives: HiveAcessoriaBanco[]): TrilhaAcessoriaMontada[] {
  return TRILHAS_ACESSORIAS.map((info): TrilhaAcessoriaMontada => {
    const minhas = hives.filter((h) => h.level_id === info.levelId).sort((a, b) => a.ordem - b.ordem);
    const progresso = minhas.filter((h) => h.estado === "concluido").length;
    return {
      ...info,
      hives: minhas,
      progresso,
      total: minhas.length,
      proxima: minhas.find((h) => h.estado !== "concluido") ?? null,
      exerciciosPreview: minhas.slice(0, 4).map((h) => h.titulo),
      maisExercicios: Math.max(0, minhas.length - 4),
    };
  });
}

/** Id da hive a abrir, trocando pela variante sem impacto quando o interruptor está ligado. */
export function hiveParaJogar(trilha: TrilhaAcessoriaMontada, hiveId: string, semImpacto: boolean): string {
  if (!semImpacto) return hiveId;
  return trilha.semImpacto?.[hiveId] ?? hiveId;
}

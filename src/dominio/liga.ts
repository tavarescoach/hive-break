/**
 * Modelo da tela Liga (seção 9.3). Os números vêm prontos do servidor
 * (função ler_liga): todo mundo do grupo que treinou na semana, mais você;
 * quem está com 0 XP vem só como contagem. Aqui só se escrevem os textos.
 */

export type Divisao = "bronze" | "prata" | "ouro" | "safira" | "diamante";
export type Zona = "subida" | "meio" | "descida";

export const NOMES_DIVISAO: Record<Divisao, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  safira: "Safira",
  diamante: "Diamante",
};

/** Artigo de cada divisão: "na Prata", "no Ouro". */
const FEMININA: Record<Divisao, boolean> = { bronze: false, prata: true, ouro: false, safira: true, diamante: false };
const na = (d: Divisao) => `${FEMININA[d] ? "na" : "no"} ${NOMES_DIVISAO[d]}`;
const paraA = (d: Divisao) => `${FEMININA[d] ? "para a" : "para o"} ${NOMES_DIVISAO[d]}`;

const ORDEM: Divisao[] = ["bronze", "prata", "ouro", "safira", "diamante"];

export interface LinhaLiga {
  posicao: number;
  apelido: string;
  avatar_url: string | null;
  pontos: number;
  eu: boolean;
}

export interface SemanaPassada {
  divisao: Divisao;
  posicao: number;
  resultado: "subiu" | "manteve" | "desceu";
}

interface Base {
  divisao: Divisao;
  semana_fim: string;
  semana_passada: SemanaPassada | null;
}

export type DadosLiga =
  | (Base & { no_grupo: false })
  | (Base & {
      no_grupo: true;
      tamanho: number;
      sobem: number;
      descem: number;
      posicao: number;
      pontos: number;
      /** Pessoas do grupo (fora você) que ainda não fizeram XP na semana. */
      sem_treino: number;
      zona: Zona;
      faltam_para_subir: number | null;
      faltam_para_ficar: number | null;
      linhas: LinhaLiga[];
    });

const xp = (n: number) => `${n} XP`;

/** Aviso da semana passada, quando o grupo dela fechou. Nunca fala em "último". */
export function textoSemanaPassada(s: SemanaPassada): string {
  if (s.resultado === "subiu") {
    const nova = ORDEM[Math.min(ORDEM.indexOf(s.divisao) + 1, ORDEM.length - 1)];
    return `Você subiu ${paraA(nova)}! Fechou a semana em ${s.posicao}º ${na(s.divisao)}.`;
  }
  if (s.resultado === "manteve") return `Você segurou seu lugar ${na(s.divisao)}. Fechou a semana em ${s.posicao}º.`;
  return "Semana nova, divisão nova. Bora recomeçar?";
}

/** Recado da posição atual. Na zona de descida, mostra só o que falta para ficar. */
export function textoZona(d: Extract<DadosLiga, { no_grupo: true }>): string {
  if (d.zona === "descida") {
    return `Faltam ${xp(d.faltam_para_ficar ?? 1)} para você ficar ${na(d.divisao)}.`;
  }
  if (d.zona === "subida") {
    return `Você está na zona de subida ${paraA(ORDEM[ORDEM.indexOf(d.divisao) + 1])}. Segura até domingo!`;
  }
  if (d.sobem === 0) return `Você está no Diamante, a divisão mais alta. Segure seu lugar.`;
  return `Faltam ${xp(d.faltam_para_subir ?? 1)} para a zona de subida.`;
}

/** Regra resumida, no tamanho real do grupo. */
export function textoRegra(d: Extract<DadosLiga, { no_grupo: true }>): string {
  const partes = [`${d.tamanho} ${d.tamanho === 1 ? "pessoa" : "pessoas"}`];
  if (d.sobem > 0) partes.push(`${d.sobem === 1 ? "sobe" : "sobem"} ${d.sobem}`);
  if (d.descem > 0) partes.push(`${d.descem === 1 ? "desce" : "descem"} ${d.descem}`);
  return partes.join(" · ");
}

/** Linha do fim da lista para quem ainda não treinou na semana. */
export function textoSemTreino(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "+1 pessoa do grupo ainda não treinou esta semana" : `+${n} pessoas do grupo ainda não treinaram esta semana`;
}

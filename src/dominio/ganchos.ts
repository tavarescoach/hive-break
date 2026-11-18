/**
 * Escolha do gancho de convite (docs/GANCHOS_CONVITE.md, seções 3.1 e 4).
 */

import { GANCHOS, ganchosDaFamilia, type Contexto, type Familia, type Gancho } from "@/conteudo/ganchos";

export interface VariaveisGancho {
  nome?: string;
  reps?: number;
  exercicio?: string;
  tempo?: string;
  dias?: number;
}

export interface EstadoDoTreino {
  recordeNovo: boolean;
  ofensivaDias: number;
  emHive: boolean;
  /** Treino do Modo Escritório (lombar, pescoço, ombro). Esse modo ainda não existe no app. */
  modoEscritorio?: boolean;
  variaveis: VariaveisGancho;
}

const FAMILIAS: Familia[] = ["D", "B", "C"];

/** Nomes das variáveis que aparecem no texto, ex. "{reps}" → "reps". */
export function variaveisDoTexto(texto: string): (keyof VariaveisGancho)[] {
  return [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as keyof VariaveisGancho);
}

/** O gancho serve neste contexto e todas as variáveis que ele usa existem neste treino. */
export function ganchoValido(gancho: Gancho, contexto: Contexto, variaveis: VariaveisGancho): boolean {
  if (!gancho.contextos.includes(contexto)) return false;
  return variaveisDoTexto(gancho.texto).every((v) => variaveis[v] !== undefined);
}

function escolherEntre(ids: string[], contexto: Contexto, variaveis: VariaveisGancho, aleatorio: () => number): Gancho | null {
  const candidatos = ids
    .map((id) => GANCHOS.find((g) => g.id === id))
    .filter((g): g is Gancho => !!g && ganchoValido(g, contexto, variaveis));
  if (candidatos.length === 0) return null;
  return candidatos[Math.floor(aleatorio() * candidatos.length)];
}

function escolherDaFamilia(familia: Familia, contexto: Contexto, variaveis: VariaveisGancho, aleatorio: () => number): Gancho | null {
  return escolherEntre(ganchosDaFamilia(familia).map((g) => g.id), contexto, variaveis, aleatorio);
}

/**
 * Escolhe o gancho pela tabela 3.1, na ordem de prioridade: recorde → ofensiva
 * longa → 1º dia → Modo Escritório → treinou em hive → rotação igual entre
 * D, B e C. Pula ganchos cuja variável não existe neste treino.
 */
export function escolherGancho(contexto: Contexto, estado: EstadoDoTreino, aleatorio: () => number = Math.random): Gancho | null {
  const { variaveis } = estado;

  if (estado.recordeNovo) {
    const g = escolherEntre(["D04", "D08", "D13"], contexto, variaveis, aleatorio);
    if (g) return g;
  }
  if (estado.ofensivaDias >= 7) {
    const g = escolherEntre(["D06", "C06"], contexto, variaveis, aleatorio);
    if (g) return g;
  }
  if (estado.ofensivaDias <= 1) {
    const g = escolherEntre(["C04"], contexto, variaveis, aleatorio);
    if (g) return g;
  }
  if (estado.modoEscritorio) {
    const g = escolherEntre(["B01", "B04", "B06", "B13", "B14"], contexto, variaveis, aleatorio);
    if (g) return g;
  }
  if (estado.emHive) {
    const g = escolherEntre(["C03", "C05", "C07"], contexto, variaveis, aleatorio);
    if (g) return g;
  }

  // Demais casos: rotação igual entre as três famílias.
  const inicio = Math.floor(aleatorio() * FAMILIAS.length);
  for (let i = 0; i < FAMILIAS.length; i++) {
    const g = escolherDaFamilia(FAMILIAS[(inicio + i) % FAMILIAS.length], contexto, variaveis, aleatorio);
    if (g) return g;
  }
  return null;
}

/** Botão "Trocar frase": outro gancho válido da mesma família, nunca o mesmo. */
export function trocarGancho(atual: Gancho, contexto: Contexto, variaveis: VariaveisGancho, aleatorio: () => number = Math.random): Gancho | null {
  const outros = ganchosDaFamilia(atual.familia).filter((g) => g.id !== atual.id);
  const candidatos = outros.filter((g) => ganchoValido(g, contexto, variaveis));
  if (candidatos.length === 0) return null;
  return candidatos[Math.floor(aleatorio() * candidatos.length)];
}

/** Preenche {nome}, {reps}, {exercicio}, {tempo} e {dias} no texto do gancho. */
export function preencherGancho(texto: string, variaveis: VariaveisGancho): string {
  return texto.replace(/\{(\w+)\}/g, (match, chave: keyof VariaveisGancho) => {
    const valor = variaveis[chave];
    return valor === undefined ? match : String(valor);
  });
}

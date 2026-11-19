/**
 * Ganchos de resgate (docs/RESGATE.md, seção 4.1): as 10 frases que quem
 * resgata pode mandar para um amigo sumido, uma por família (Desafio,
 * Benefício, Companhia). Dados num arquivo só, como pede GANCHOS_CONVITE.md
 * seção 5, em vez de espalhados nas telas.
 */

export type FamiliaResgate = "D" | "B" | "C";

export interface GanchoResgate {
  id: string;
  familia: FamiliaResgate;
  texto: string;
}

export const GANCHOS_RESGATE: readonly GanchoResgate[] = [
  { id: "RD1", familia: "D", texto: "Tenta bater meu recorde: {reps} {exercicio} em {tempo}. Bora?" },
  { id: "RD2", familia: "D", texto: "Fiz {reps} {exercicio} hoje. Duvido você passar." },
  { id: "RD3", familia: "D", texto: "Revanche? Meu placar tá te esperando." },
  { id: "RB1", familia: "B", texto: "Me ajuda a cuidar da coluna? 3 minutos de exercício comigo." },
  { id: "RB2", familia: "B", texto: "3 minutos pra tarde ficar mais leve. Faz comigo hoje?" },
  { id: "RB3", familia: "B", texto: "Pescoço travado de call? Bora 3 minutos juntos." },
  { id: "RC1", familia: "C", texto: "Juntos rende mais: entra na minha hive e ganha até +60% de XP." },
  { id: "RC2", familia: "C", texto: "Sentimos sua falta na hive. 3 minutinhos hoje?" },
  { id: "RC3", familia: "C", texto: "Bora voltar? Eu faço com você." },
  { id: "RC4", familia: "C", texto: "Sua sequência pode recomeçar hoje. Vem comigo." },
] as const;

export interface DadosResgate {
  /** Recorde ou resultado de hoje de quem resgata, com repetições (seção 4.1). */
  resultadoHoje?: { reps: number; exercicio: string; tempo: string } | null;
  /** Quem resgata fazia treinos do Modo Escritório: prioriza RB1/RB3. */
  modoEscritorio?: boolean;
  /** Quem resgata vai abrir (ou abriu) uma hive agora: usa RC1. */
  vaiAbrirHive?: boolean;
}

export interface SugestaoResgate {
  id: string;
  familia: FamiliaResgate;
  texto: string;
}

function ganchoPorId(id: string): GanchoResgate {
  const g = GANCHOS_RESGATE.find((x) => x.id === id);
  if (!g) throw new Error(`Gancho de resgate "${id}" não existe.`);
  return g;
}

/** `{token}` sem valor: a frase não serve para esse treino (igual a lembrete_tem_token no banco). */
export function textoTemToken(texto: string): boolean {
  return /\{[^{}\s]+\}/.test(texto);
}

function varsDeResgate(dados: DadosResgate): Record<string, string | undefined> {
  return {
    reps: dados.resultadoHoje ? String(dados.resultadoHoje.reps) : undefined,
    exercicio: dados.resultadoHoje?.exercicio,
    tempo: dados.resultadoHoje?.tempo,
  };
}

export function preencherGancho(id: string, vars: Record<string, string | undefined>): string {
  return ganchoPorId(id).texto.replace(/\{(\w+)\}/g, (_, chave: string) => vars[chave] ?? `{${chave}}`);
}

function primeiroValido(ids: readonly string[], vars: Record<string, string | undefined>): SugestaoResgate {
  for (const id of ids) {
    const texto = preencherGancho(id, vars);
    if (!textoTemToken(texto)) {
      const g = ganchoPorId(id);
      return { id: g.id, familia: g.familia, texto };
    }
  }
  const ultimo = ganchoPorId(ids[ids.length - 1]);
  return { id: ultimo.id, familia: ultimo.familia, texto: preencherGancho(ultimo.id, vars) };
}

/**
 * As 3 sugestões iniciais da folha de escolha (seção 4): uma por família, já
 * preenchidas com os dados reais de quem resgata.
 */
export function escolherGanchosResgate(dados: DadosResgate): SugestaoResgate[] {
  const vars = varsDeResgate(dados);
  const ordemD = ["RD1", "RD2", "RD3"] as const;
  const ordemB = dados.modoEscritorio ? (["RB1", "RB3", "RB2"] as const) : (["RB1", "RB2", "RB3"] as const);
  const ordemC = dados.vaiAbrirHive ? (["RC1", "RC2", "RC3", "RC4"] as const) : (["RC2", "RC3", "RC4", "RC1"] as const);
  return [primeiroValido(ordemD, vars), primeiroValido(ordemB, vars), primeiroValido(ordemC, vars)];
}

/** Botão "Trocar frase": a próxima opção válida da mesma família. */
export function proximaFraseDaFamilia(id: string, dados: DadosResgate = {}): SugestaoResgate {
  const vars = varsDeResgate(dados);
  const atual = ganchoPorId(id);
  const daFamilia = GANCHOS_RESGATE.filter((g) => g.familia === atual.familia);
  const i = daFamilia.findIndex((g) => g.id === id);
  for (let passo = 1; passo <= daFamilia.length; passo++) {
    const candidato = daFamilia[(i + passo) % daFamilia.length];
    const texto = preencherGancho(candidato.id, vars);
    if (!textoTemToken(texto)) {
      return { id: candidato.id, familia: candidato.familia, texto };
    }
  }
  return { id: atual.id, familia: atual.familia, texto: preencherGancho(atual.id, vars) };
}

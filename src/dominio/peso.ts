/**
 * Card de objetivo com peso (docs/PERFIL.md, seção 2.3). Lógica pura da
 * barra: ela nunca fica vermelha — só amarela (anda na direção da meta) ou
 * cinza neutro (anda para o outro lado), sem textos de culpa.
 */
import type { Opcao } from "./perfil";

export type VisibilidadePeso = "eu" | "variacao" | "tudo";

export const VISIBILIDADES_PESO: Opcao<VisibilidadePeso>[] = [
  { valor: "eu", rotulo: "Só eu", ajuda: "Os outros não veem nada sobre o seu peso." },
  { valor: "variacao", rotulo: "Mostrar variação", ajuda: "Os outros veem quanto você ganhou ou perdeu, nunca o peso em kg." },
  { valor: "tudo", rotulo: "Mostrar tudo", ajuda: "Quem está logado vê o peso e a meta. No perfil público, nunca." },
];

const arredondar1 = (n: number) => Math.round(n * 10) / 10;

export function formatarVariacao(variacaoKg: number): string {
  const sinal = variacaoKg > 0 ? "+" : variacaoKg < 0 ? "−" : "";
  const verbo = variacaoKg >= 0 ? "ganhos" : "perdidos";
  return `${sinal}${Math.abs(arredondar1(variacaoKg)).toLocaleString("pt-BR")} kg ${verbo}`;
}

export interface BarraPeso {
  /** 0 a 100: o quanto já foi andado até a meta. 0 quando não há meta ou a pessoa foi para o lado contrário. */
  pct: number;
  /** true = anda na direção da meta (barra amarela). false = anda para o outro lado (barra cinza, nunca vermelha). */
  naDirecaoDaMeta: boolean;
  rotulo: string;
}

/** `desde` é só exibição (ex.: "02/11"); já formatada por quem chama. */
export function calcularBarraPeso(args: { inicial: number; atual: number; meta: number | null; desde: string }): BarraPeso {
  const { inicial, atual, meta, desde } = args;
  const variacao = arredondar1(atual - inicial);
  const rotulo = `${formatarVariacao(variacao)} desde ${desde}`;

  if (meta === null || meta === inicial) {
    return { pct: 0, naDirecaoDaMeta: true, rotulo };
  }
  const alvo = arredondar1(meta - inicial);
  const naDirecaoDaMeta = Math.sign(variacao) === Math.sign(alvo) || variacao === 0;
  const pct = naDirecaoDaMeta ? Math.min(100, Math.max(0, (variacao / alvo) * 100)) : 0;
  return { pct, naDirecaoDaMeta, rotulo };
}

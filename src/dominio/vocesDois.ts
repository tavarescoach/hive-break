/** "Vocês dois" (docs/PERFIL.md, seção 2.7): comparação da semana, dia a dia. */

export interface DiaMeta {
  dia: string;
  hives: number;
}

export interface DiaComparado {
  dia: string;
  eu: number;
  dele: number;
}

/** As duas semanas vêm na mesma ordem (segunda a domingo) de meta_semana(). */
export function compararSemanas(meusDias: DiaMeta[], diasDele: DiaMeta[]): DiaComparado[] {
  return meusDias.map((d, i) => ({ dia: d.dia, eu: d.hives, dele: diasDele[i]?.hives ?? 0 }));
}

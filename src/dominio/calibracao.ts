/**
 * Calibração (Etapa C do docs/PLANO_ETAPAS_UX.md): compara a contagem do app
 * com a do professor, série por série, e diz quais exercícios já podem virar
 * `calibrado: true` no catálogo. Funções puras: o banco só guarda as séries.
 */

/** Concordância mínima (média por pessoa) para a pessoa "aprovar" o exercício [validar]. */
export const CONCORDANCIA_MINIMA = 0.9;
/** Pessoas diferentes, cada uma com concordância ≥ mínima, para o exercício ficar pronto [validar]. */
export const PESSOAS_MINIMAS = 5;

export interface SerieCalibracao {
  id: number;
  exercicio_id: string;
  tipo: "reps" | "tempo";
  pessoa: string;
  app_reps: number | null;
  prof_reps: number | null;
  app_tempo_s: number | null;
  prof_tempo_s: number | null;
}

/**
 * O quanto o app bateu com o professor, de 0 a 1. O professor é a referência:
 * 1 − |app − professor| / professor (professor 0 e app 0 = 1; nunca abaixo de 0).
 */
export function concordancia(app: number, professor: number): number {
  if (professor <= 0) return app <= 0 ? 1 : 0;
  return Math.max(0, 1 - Math.abs(app - professor) / professor);
}

/** Valores comparados de uma série, conforme o tipo (reps ou segundos). */
export function valoresDaSerie(s: SerieCalibracao): { app: number; professor: number } {
  return s.tipo === "reps"
    ? { app: s.app_reps ?? 0, professor: s.prof_reps ?? 0 }
    : { app: Number(s.app_tempo_s ?? 0), professor: Number(s.prof_tempo_s ?? 0) };
}

export interface RelatorioExercicio {
  exercicioId: string;
  series: number;
  pessoas: number;
  /** Média da concordância de todas as séries (0 a 1). */
  concordanciaMedia: number;
  /** Pessoas cuja média ficou ≥ CONCORDANCIA_MINIMA. */
  pessoasAprovadas: number;
  /** Séries em que o app contou MAIS que o professor (contou rep que não valia). */
  appContouAMais: number;
  /** Séries em que o app contou MENOS que o professor (perdeu rep boa). */
  appContouAMenos: number;
  /** Diferença média (app − professor), em reps ou segundos: positivo = app generoso, negativo = app exigente. */
  diferencaMedia: number;
  pronto: boolean;
}

/** Relatório por exercício, do mais perto de ficar pronto para o mais longe. */
export function relatorio(series: SerieCalibracao[]): RelatorioExercicio[] {
  const porExercicio = new Map<string, SerieCalibracao[]>();
  for (const s of series) porExercicio.set(s.exercicio_id, [...(porExercicio.get(s.exercicio_id) ?? []), s]);

  const lista: RelatorioExercicio[] = [];
  for (const [exercicioId, doExercicio] of porExercicio) {
    const porPessoa = new Map<string, number[]>();
    let soma = 0;
    let somaDiferenca = 0;
    let aMais = 0;
    let aMenos = 0;
    for (const s of doExercicio) {
      const { app, professor } = valoresDaSerie(s);
      const c = concordancia(app, professor);
      soma += c;
      somaDiferenca += app - professor;
      if (app > professor) aMais++;
      else if (app < professor) aMenos++;
      const chave = s.pessoa.trim().toLowerCase();
      porPessoa.set(chave, [...(porPessoa.get(chave) ?? []), c]);
    }
    const aprovadas = [...porPessoa.values()].filter((cs) => cs.reduce((a, b) => a + b, 0) / cs.length >= CONCORDANCIA_MINIMA).length;
    const media = soma / doExercicio.length;
    lista.push({
      exercicioId,
      series: doExercicio.length,
      pessoas: porPessoa.size,
      concordanciaMedia: media,
      pessoasAprovadas: aprovadas,
      appContouAMais: aMais,
      appContouAMenos: aMenos,
      diferencaMedia: somaDiferenca / doExercicio.length,
      pronto: aprovadas >= PESSOAS_MINIMAS && media >= CONCORDANCIA_MINIMA,
    });
  }
  return lista.sort((a, b) => Number(b.pronto) - Number(a.pronto) || b.pessoasAprovadas - a.pessoasAprovadas || b.concordanciaMedia - a.concordanciaMedia);
}

/** Leitura em uma frase do que fazer com o exercício, para o professor. */
export function leitura(r: RelatorioExercicio): string {
  if (r.pronto) return "Pronto: pode virar calibrado no catálogo.";
  const faltam = Math.max(0, PESSOAS_MINIMAS - r.pessoasAprovadas);
  if (r.concordanciaMedia >= CONCORDANCIA_MINIMA) return `Bom até aqui. Falta testar com ${faltam} ${faltam === 1 ? "pessoa" : "pessoas"}.`;
  if (r.diferencaMedia > 0) return "O app está generoso: conta repetição que não valia. Os limiares precisam ficar mais exigentes.";
  if (r.diferencaMedia < 0) return "O app está exigente: perde repetição boa. Os limiares precisam ficar mais tolerantes.";
  return "O app erra para os dois lados: rever posição do celular e os limiares.";
}

/**
 * Amostragem da medida principal durante a série, a no máximo `hz` por segundo,
 * para guardar a série temporal leve (reajuste dos limiares depois).
 */
export class AmostradorSerie {
  private readonly intervaloMs: number;
  private ultimo = Number.NEGATIVE_INFINITY;
  private inicio: number | null = null;
  readonly pontos: [number, number][] = [];

  constructor(hz = 10, private readonly maxPontos = 6000) {
    this.intervaloMs = 1000 / hz;
  }

  registrar(t: number, valor: number | undefined): void {
    if (valor === undefined || !Number.isFinite(valor) || this.pontos.length >= this.maxPontos) return;
    if (t - this.ultimo < this.intervaloMs) return;
    this.inicio ??= t;
    this.ultimo = t;
    this.pontos.push([Math.round(t - this.inicio), Math.round(valor * 100) / 100]);
  }
}

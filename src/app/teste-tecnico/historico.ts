/**
 * Histórico das conferências do teste técnico. Fica só neste aparelho
 * (localStorage): são números para o Luan avaliar o erro de contagem.
 */
export interface RegistroConferencia {
  quando: string;
  exercicio: string;
  nomeExercicio: string;
  unidade: "reps" | "s";
  motor: number;
  manual: number;
  parciais: number;
  modelo: string;
  delegado: string;
  fps: number;
}

const CHAVE = "hive-break:teste-tecnico:historico";
const VAZIO: RegistroConferencia[] = [];
const ouvintes = new Set<() => void>();
let cache: RegistroConferencia[] | null = null;

function ler(): RegistroConferencia[] {
  if (cache) return cache;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    cache = bruto ? (JSON.parse(bruto) as RegistroConferencia[]) : VAZIO;
  } catch {
    cache = VAZIO;
  }
  return cache;
}

function gravar(lista: RegistroConferencia[]): void {
  cache = lista;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    // Armazenamento indisponível (aba anônima): o histórico vale só nesta visita.
  }
  ouvintes.forEach((avisar) => avisar());
}

export const historico = {
  assinar(avisar: () => void) {
    ouvintes.add(avisar);
    return () => ouvintes.delete(avisar);
  },
  atual: ler,
  noServidor: () => VAZIO,
  adicionar(registro: RegistroConferencia) {
    gravar([registro, ...ler()].slice(0, 200));
  },
  limpar() {
    gravar(VAZIO);
  },
};

/** Tolerância da especificação: 1 rep a cada 10; 2 s a cada 60 s. */
export function dentroDaTolerancia(r: Pick<RegistroConferencia, "unidade" | "motor" | "manual">): boolean {
  const erro = Math.abs(r.motor - r.manual);
  if (r.unidade === "reps") return erro <= Math.max(1, Math.floor(r.manual / 10));
  return erro <= Math.max(2, (2 * r.manual) / 60);
}

export interface ResumoExercicio {
  exercicio: string;
  nomeExercicio: string;
  unidade: "reps" | "s";
  tentativas: number;
  dentro: number;
  /** Erro médio por 10 reps (ou por 60 s). */
  erroNormalizado: number;
}

export function resumirPorExercicio(lista: RegistroConferencia[]): ResumoExercicio[] {
  const grupos = new Map<string, RegistroConferencia[]>();
  for (const r of lista) grupos.set(r.exercicio, [...(grupos.get(r.exercicio) ?? []), r]);
  return [...grupos.values()].map((registros) => {
    const { exercicio, nomeExercicio, unidade } = registros[0];
    const somaErro = registros.reduce((s, r) => s + Math.abs(r.motor - r.manual), 0);
    const somaManual = registros.reduce((s, r) => s + r.manual, 0);
    const base = unidade === "reps" ? 10 : 60;
    return {
      exercicio,
      nomeExercicio,
      unidade,
      tentativas: registros.length,
      dentro: registros.filter(dentroDaTolerancia).length,
      erroNormalizado: somaManual > 0 ? (somaErro / somaManual) * base : 0,
    };
  });
}

export function textoDoHistorico(lista: RegistroConferencia[]): string {
  const linhas = lista.map(
    (r) =>
      `${r.quando.slice(0, 16).replace("T", " ")} | ${r.nomeExercicio} | motor ${r.motor} ${r.unidade} | manual ${r.manual} ${r.unidade} | parciais ${r.parciais} | ${r.modelo}/${r.delegado} | ${r.fps} fps`,
  );
  return ["Hive Break · teste técnico (Fase 0)", ...linhas].join("\n");
}

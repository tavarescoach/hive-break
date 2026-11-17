/**
 * Métodos dos desafios (docs/METODOS.md): intervalado por tempo, Tabata,
 * séries e repetições, circuito, EMOM, escada e contra o relógio.
 *
 * Um método é só dado. `montarLinhaDoTempo` transforma o método numa sequência
 * de fases (preparo, trabalho, descanso, transição) que a tela percorre com ou
 * sem câmera. Código puro, testado sem navegador.
 */

/** Meta de uma fase de trabalho com tempo fixo. */
export type Meta =
  /** O máximo de repetições válidas no tempo. */
  | { tipo: "amrap" }
  /** Faixa de repetições por exercício (controle de ritmo), na ordem dos exercícios. */
  | { tipo: "faixa"; por_exercicio: { min: number; max: number }[] }
  /** Manter a posição (isometria, postura, equilíbrio). */
  | { tipo: "sustentar" };

/** Item de circuito ou de contra o relógio: repetições ou segundos, um por exercício. */
export type Item = { reps: number } | { segundos: number };

export type Metodo =
  /** Trabalho e descanso por tempo; os exercícios se alternam a cada série. */
  | { tipo: "intervalado"; trabalho_s: number; descanso_s: number; series: number; meta: Meta }
  /** Protocolo Tabata: 8 rounds de 20 s com 10 s de descanso; exercícios se alternam. */
  | { tipo: "tabata"; rounds: number; trabalho_s: number; descanso_s: number }
  /** Séries e repetições: cada exercício faz todas as suas séries antes do próximo. */
  | { tipo: "series"; series: number; reps: number; descanso_s: number }
  /** Exercícios em sequência sem pausa; descanso entre rodadas. */
  | { tipo: "circuito"; rodadas: number; descanso_s: number; itens: Item[] }
  /** A cada minuto, X repetições; o resto do minuto é descanso. Exercícios se alternam por minuto. */
  | { tipo: "emom"; minutos: number; reps: number }
  /** Degraus de repetições sem pausa (ex.: 2-4-6-8), até o teto de tempo. Um exercício. */
  | { tipo: "escada"; degraus: number[]; teto_s: number }
  /** Uma lista de tarefas no menor tempo, com teto. */
  | { tipo: "contra_relogio"; itens: Item[]; teto_s: number };

export type TipoMetodo = Metodo["tipo"];

/** O que o método precisa saber de cada exercício. */
export interface ExercicioMetodo {
  nome: string;
  /** Exercício de sustentação (isometria, postura, equilíbrio, respiração): mede tempo, não reps. */
  sustentacao: boolean;
  /** Ritmo de referência, em segundos por repetição (estimativa de duração). */
  segPorRep: number;
}

export type Fase =
  /** Início do desafio: espera o corpo aparecer (com câmera) e conta 3, 2, 1. */
  | { tipo: "preparo"; exercicio: number }
  /** Troca de exercício sem descanso no meio (circuito, contra o relógio). */
  | { tipo: "transicao"; exercicio: number; duracaoMs: number }
  | { tipo: "descanso"; duracaoMs: number; proximo: number; rotuloProximo: string }
  | FaseTrabalho;

export interface FaseTrabalho {
  tipo: "trabalho";
  exercicio: number;
  /** Ex.: "2ª série de 3", "Round 5 de 8", "Minuto 2 de 5". */
  rotulo: string;
  /** Tempo fixo da fase. Ausente: termina ao completar `alvoReps`. */
  duracaoMs?: number;
  /** Repetições que fecham a fase (séries, escada, EMOM, circuito por reps). */
  alvoReps?: number;
  /** Faixa de repetições (intervalado com meta de faixa). */
  faixa?: { min: number; max: number };
  /** Fase de sustentação: o que conta é o tempo na posição. */
  sustentar: boolean;
  /** EMOM: ao bater o alvo antes do fim do minuto, o resto vira descanso. */
  emom?: boolean;
}

export interface LinhaDoTempo {
  metodo: Metodo;
  fases: Fase[];
  /** Teto de tempo do desafio inteiro (escada, contra o relógio), contado a partir do primeiro trabalho. */
  tetoMs?: number;
  /** Duração planejada, em segundos (trabalho + descanso + transições). */
  duracaoEstimadaS: number;
}

/** Duração das transições entre exercícios diferentes sem descanso no meio. */
export const TRANSICAO_MS = 3000;
/** Limite de um desafio (decisão do Luan: inclui os descansos). */
export const DURACAO_MAXIMA_S = 300;

const ordinal = (n: number) => `${n}ª`;

export const NOME_METODO: Record<TipoMetodo, string> = {
  intervalado: "Intervalado",
  tabata: "Tabata",
  series: "Séries e repetições",
  circuito: "Circuito",
  emom: "EMOM",
  escada: "Escada",
  contra_relogio: "Contra o relógio",
};

/** Descrição curta do método para o card e a tela de preparação. */
export function descreverMetodo(m: Metodo): string {
  switch (m.tipo) {
    case "intervalado": {
      const meta = m.meta.tipo === "amrap" ? "máximo de reps" : m.meta.tipo === "sustentar" ? "segure a posição" : "reps na faixa";
      return `${m.series} séries de ${m.trabalho_s} s · ${m.descanso_s} s de pausa · ${meta}`;
    }
    case "tabata":
      return `${m.rounds} rounds de ${m.trabalho_s} s · ${m.descanso_s} s de pausa`;
    case "series":
      return `${m.series} séries de ${m.reps} reps · ${m.descanso_s} s de intervalo`;
    case "circuito":
      return `${m.rodadas} ${m.rodadas === 1 ? "rodada" : "rodadas"} sem pausa entre exercícios${m.rodadas > 1 ? ` · ${m.descanso_s} s entre rodadas` : ""}`;
    case "emom":
      return `${m.reps} reps a cada minuto, por ${m.minutos} minutos`;
    case "escada":
      return `Degraus de ${m.degraus.join("-")} reps em até ${Math.round(m.teto_s / 60)} min`;
    case "contra_relogio":
      return `Complete tudo no menor tempo · teto de ${Math.round(m.teto_s / 60)} min`;
  }
}

/** Confere um método. Devolve a lista de problemas (vazia quando está tudo certo). */
export function validarMetodo(m: Metodo, exercicios: ExercicioMetodo[]): string[] {
  const p: string[] = [];
  const n = exercicios.length;
  const entre = (v: number, a: number, b: number, nome: string) => {
    if (!Number.isFinite(v) || v < a || v > b) p.push(`${nome} fora de ${a} a ${b}`);
  };
  if (n === 0) p.push("desafio sem exercícios");
  const semSustentacao = (nome: string) => {
    if (exercicios.some((e) => e.sustentacao)) p.push(`${nome} não aceita exercício de sustentação`);
  };
  switch (m.tipo) {
    case "intervalado":
      entre(m.trabalho_s, 10, 120, "trabalho_s");
      entre(m.descanso_s, 0, 60, "descanso_s");
      entre(m.series, 1, 12, "series");
      if (m.meta.tipo === "faixa") {
        if (m.meta.por_exercicio.length !== n) p.push("faixa precisa de um item por exercício");
        if (m.meta.por_exercicio.some((f) => !(f.min >= 1 && f.max >= f.min))) p.push("faixa inválida");
        semSustentacao("faixa de repetições");
      }
      if (m.meta.tipo === "sustentar" && exercicios.some((e) => !e.sustentacao)) p.push("sustentar só vale para exercícios de sustentação");
      if (m.meta.tipo === "amrap" && exercicios.some((e) => e.sustentacao)) p.push("AMRAP não vale para exercícios de sustentação");
      break;
    case "tabata":
      entre(m.rounds, 2, 12, "rounds");
      entre(m.trabalho_s, 10, 60, "trabalho_s");
      entre(m.descanso_s, 5, 60, "descanso_s");
      semSustentacao("Tabata");
      break;
    case "series":
      entre(m.series, 1, 5, "series");
      entre(m.reps, 1, 30, "reps");
      entre(m.descanso_s, 0, 120, "descanso_s");
      semSustentacao("séries e repetições");
      break;
    case "circuito":
    case "contra_relogio":
      if (m.itens.length !== n) p.push("é preciso um item por exercício");
      m.itens.forEach((item, i) => {
        const e = exercicios[i];
        if (!e) return;
        if ("reps" in item) {
          entre(item.reps, 1, 60, `itens[${i}].reps`);
          if (e.sustentacao) p.push(`${e.nome} é de sustentação: use segundos`);
        } else {
          entre(item.segundos, 5, 300, `itens[${i}].segundos`);
        }
      });
      if (m.tipo === "circuito") {
        entre(m.rodadas, 1, 6, "rodadas");
        entre(m.descanso_s, 0, 90, "descanso_s");
      } else {
        entre(m.teto_s, 30, 300, "teto_s");
      }
      break;
    case "emom":
      entre(m.minutos, 2, 5, "minutos");
      entre(m.reps, 1, 40, "reps");
      semSustentacao("EMOM");
      break;
    case "escada":
      if (n !== 1) p.push("escada usa um exercício");
      if (m.degraus.length < 2 || m.degraus.some((d) => !(d >= 1 && d <= 30))) p.push("degraus inválidos");
      entre(m.teto_s, 30, 300, "teto_s");
      semSustentacao("escada");
      break;
  }
  return p;
}

/** Monta a sequência de fases do método. */
export function montarLinhaDoTempo(metodo: Metodo, exercicios: ExercicioMetodo[]): LinhaDoTempo {
  const fases: Fase[] = [];
  const n = exercicios.length;
  const sust = (i: number) => exercicios[i]?.sustentacao ?? false;
  const nome = (i: number) => exercicios[i]?.nome ?? "";

  const trabalho = (f: Omit<FaseTrabalho, "tipo" | "sustentar"> & { sustentar?: boolean }) =>
    fases.push({ tipo: "trabalho", sustentar: f.sustentar ?? sust(f.exercicio), ...f });
  const descanso = (s: number, proximo: number, rotuloProximo: string) => {
    if (s > 0) fases.push({ tipo: "descanso", duracaoMs: s * 1000, proximo, rotuloProximo });
  };
  /** Entre dois trabalhos sem descanso, com troca de exercício: 3 s de transição. */
  const transicaoSePreciso = (proximo: number) => {
    const ultima = fases[fases.length - 1];
    if (ultima?.tipo === "trabalho" && ultima.exercicio !== proximo) {
      fases.push({ tipo: "transicao", exercicio: proximo, duracaoMs: TRANSICAO_MS });
    }
  };
  const itemRotulo = (item: Item) => ("reps" in item ? `${item.reps} reps` : `${item.segundos} s`);

  let tetoMs: number | undefined;
  fases.push({ tipo: "preparo", exercicio: 0 });

  switch (metodo.tipo) {
    case "intervalado":
    case "tabata": {
      const total = metodo.tipo === "tabata" ? metodo.rounds : metodo.series;
      for (let i = 0; i < total; i++) {
        const ex = i % n;
        const rotulo = metodo.tipo === "tabata" ? `Round ${i + 1} de ${total}` : `${ordinal(i + 1)} série de ${total}`;
        const faixa = metodo.tipo === "intervalado" && metodo.meta.tipo === "faixa" ? metodo.meta.por_exercicio[ex] : undefined;
        trabalho({ exercicio: ex, rotulo, duracaoMs: metodo.trabalho_s * 1000, faixa });
        if (i < total - 1) {
          const prox = (i + 1) % n;
          const rot = metodo.tipo === "tabata" ? `Round ${i + 2} · ${nome(prox)}` : `${ordinal(i + 2)} série · ${nome(prox)}`;
          descanso(metodo.descanso_s, prox, rot);
          if (metodo.descanso_s === 0) transicaoSePreciso(prox);
        }
      }
      break;
    }
    case "series": {
      for (let ex = 0; ex < n; ex++) {
        for (let s = 0; s < metodo.series; s++) {
          trabalho({ exercicio: ex, rotulo: `${ordinal(s + 1)} série de ${metodo.series}`, alvoReps: metodo.reps });
          const ultima = ex === n - 1 && s === metodo.series - 1;
          if (ultima) continue;
          const prox = s < metodo.series - 1 ? ex : ex + 1;
          const proxSerie = s < metodo.series - 1 ? s + 2 : 1;
          descanso(metodo.descanso_s, prox, `${ordinal(proxSerie)} série · ${nome(prox)} · ${metodo.reps} reps`);
          if (metodo.descanso_s === 0) transicaoSePreciso(prox);
        }
      }
      break;
    }
    case "circuito": {
      for (let r = 0; r < metodo.rodadas; r++) {
        metodo.itens.forEach((item, ex) => {
          if (ex > 0 || r > 0) transicaoSePreciso(ex);
          const rotulo = `Rodada ${r + 1} de ${metodo.rodadas} · ${itemRotulo(item)}`;
          if ("reps" in item) trabalho({ exercicio: ex, rotulo, alvoReps: item.reps });
          else trabalho({ exercicio: ex, rotulo, duracaoMs: item.segundos * 1000 });
        });
        if (r < metodo.rodadas - 1) {
          descanso(metodo.descanso_s, 0, `Rodada ${r + 2} · ${nome(0)}`);
        }
      }
      break;
    }
    case "emom": {
      for (let m = 0; m < metodo.minutos; m++) {
        trabalho({ exercicio: m % n, rotulo: `Minuto ${m + 1} de ${metodo.minutos}`, alvoReps: metodo.reps, duracaoMs: 60_000, emom: true });
      }
      break;
    }
    case "escada": {
      metodo.degraus.forEach((reps, d) => {
        trabalho({ exercicio: 0, rotulo: `Degrau ${d + 1} de ${metodo.degraus.length} · ${reps} reps`, alvoReps: reps });
      });
      tetoMs = metodo.teto_s * 1000;
      break;
    }
    case "contra_relogio": {
      metodo.itens.forEach((item, ex) => {
        if (ex > 0) transicaoSePreciso(ex);
        const rotulo = `Tarefa ${ex + 1} de ${metodo.itens.length} · ${itemRotulo(item)}`;
        if ("reps" in item) trabalho({ exercicio: ex, rotulo, alvoReps: item.reps });
        else trabalho({ exercicio: ex, rotulo, duracaoMs: item.segundos * 1000 });
      });
      tetoMs = metodo.teto_s * 1000;
      break;
    }
  }

  return { metodo, fases, tetoMs, duracaoEstimadaS: estimar(fases, exercicios, tetoMs) };
}

/** Duração planejada: fases por tempo pelo relógio; fases por reps pelo ritmo de referência. */
function estimar(fases: Fase[], exercicios: ExercicioMetodo[], tetoMs?: number): number {
  let ms = 0;
  for (const f of fases) {
    if (f.tipo === "descanso" || f.tipo === "transicao") ms += f.duracaoMs;
    else if (f.tipo === "trabalho") {
      ms += f.duracaoMs ?? (f.alvoReps ?? 0) * (exercicios[f.exercicio]?.segPorRep ?? 3) * 1000;
    }
  }
  if (tetoMs !== undefined) ms = Math.min(ms, tetoMs);
  return Math.round(ms / 1000);
}

/** Segundos de trabalho planejados por exercício (para a validação de números no servidor). */
export function segundosPorExercicio(linha: LinhaDoTempo, exercicios: ExercicioMetodo[]): number[] {
  const total = exercicios.map(() => 0);
  for (const f of linha.fases) {
    if (f.tipo !== "trabalho") continue;
    total[f.exercicio] += f.duracaoMs !== undefined ? f.duracaoMs / 1000 : (f.alvoReps ?? 0) * (exercicios[f.exercicio]?.segPorRep ?? 3);
  }
  return total.map((s) => Math.max(10, Math.ceil(s)));
}

// ---------------------------------------------------------------- sessão

/** Resultado de uma fase de trabalho. Só números. */
export interface ResultadoFase {
  fase: number;
  exercicio: number;
  reps: number;
  parciais: number;
  tempoValidoMs: number;
  duracaoMs: number;
  /** Bateu a meta da fase (reps, faixa, EMOM no minuto, sustentou 80% do tempo). */
  cumprida: boolean;
  /** A fase foi interrompida antes do fim (Pular, Encerrar ou teto). */
  interrompida: boolean;
}

/** O que a tela informa a cada quadro. */
export interface EntradaSessao {
  /** Repetições válidas na fase de trabalho atual. */
  reps: number;
  parciais: number;
  /** Tempo na posição na fase atual (sustentação). */
  tempoValidoMs: number;
  /** Corpo inteiro visível e estável (só importa no preparo). */
  pronto: boolean;
  /** Pessoa fora do quadro: o tempo de trabalho para. */
  foraDoQuadro: boolean;
  /** Pausa da tela (ex.: "Senti dor"): tudo para. */
  pausado: boolean;
}

export type EventoSessao =
  | { tipo: "fase"; indice: number; fase: Fase }
  | { tipo: "resultado"; resultado: ResultadoFase }
  | { tipo: "emom_cumprido" }
  | { tipo: "contagem"; segundos: number }
  | { tipo: "fim"; motivo: "concluido" | "encerrado" | "teto" };

const CONTAGEM_PREPARO_MS = 3000;

/**
 * Percorre a linha do tempo. Recebe o relógio e os números da câmera (ou os
 * toques do modo sem câmera) e decide quando cada fase começa e termina.
 */
export class SessaoTreino {
  indice = 0;
  /** Tempo decorrido na fase atual (sem as pausas). */
  decorridoMs = 0;
  /** Preparo: momento em que a contagem 3-2-1 começou. */
  contagemDesde: number | null = null;
  emomCumprido = false;
  terminou = false;
  /** Tempo de trabalho desde o primeiro trabalho (para o teto). */
  totalMs = 0;
  readonly resultados: ResultadoFase[] = [];
  private tAnterior: number | null = null;
  private ultimaEntrada: EntradaSessao = { reps: 0, parciais: 0, tempoValidoMs: 0, pronto: false, foraDoQuadro: false, pausado: false };
  private ultimoSegundo = -1;

  constructor(readonly linha: LinhaDoTempo) {}

  get fase(): Fase {
    return this.linha.fases[this.indice];
  }

  /** Tempo que falta na fase atual (fases por tempo), em ms. */
  get restanteMs(): number | null {
    const f = this.fase;
    if (f.tipo === "preparo") return this.contagemDesde === null ? null : CONTAGEM_PREPARO_MS - this.decorridoMs;
    if (f.tipo === "trabalho" && f.duracaoMs === undefined) return null;
    return Math.max(0, (f.tipo === "trabalho" ? f.duracaoMs! : f.duracaoMs) - this.decorridoMs);
  }

  /** Tempo que falta até o teto do desafio, quando houver. */
  get restanteTetoMs(): number | null {
    return this.linha.tetoMs === undefined ? null : Math.max(0, this.linha.tetoMs - this.totalMs);
  }

  /** Fração da fase já feita (0 a 1), para o anel. */
  get progresso(): number {
    const f = this.fase;
    if (f.tipo === "trabalho" && f.duracaoMs === undefined) {
      return f.alvoReps ? Math.min(1, this.ultimaEntrada.reps / f.alvoReps) : 0;
    }
    const total = f.tipo === "preparo" ? CONTAGEM_PREPARO_MS : f.duracaoMs!;
    if (f.tipo === "preparo" && this.contagemDesde === null) return 0;
    return Math.min(1, this.decorridoMs / total);
  }

  tick(t: number, entrada: EntradaSessao): EventoSessao[] {
    const eventos: EventoSessao[] = [];
    if (this.terminou) return eventos;
    const dt = this.tAnterior === null ? 0 : Math.max(0, Math.min(500, t - this.tAnterior));
    this.tAnterior = t;
    this.ultimaEntrada = entrada;
    if (entrada.pausado) return eventos;

    const f = this.fase;
    switch (f.tipo) {
      case "preparo":
        if (this.contagemDesde === null) {
          if (entrada.pronto) {
            this.contagemDesde = t;
            this.decorridoMs = 0;
          }
          break;
        }
        this.decorridoMs += dt;
        this.contar(eventos);
        if (this.decorridoMs >= CONTAGEM_PREPARO_MS) this.avancar(eventos);
        break;
      case "descanso":
      case "transicao":
        this.decorridoMs += dt;
        this.contar(eventos);
        if (this.decorridoMs >= f.duracaoMs) this.avancar(eventos);
        break;
      case "trabalho": {
        // Fora do quadro, o relógio da fase para (seção 3.5). Fases por reps não têm relógio.
        if (!entrada.foraDoQuadro) {
          this.decorridoMs += dt;
          this.totalMs += dt;
        }
        if (f.emom && !this.emomCumprido && f.alvoReps !== undefined && entrada.reps >= f.alvoReps) {
          this.emomCumprido = true;
          eventos.push({ tipo: "emom_cumprido" });
        }
        if (this.linha.tetoMs !== undefined && this.totalMs >= this.linha.tetoMs) {
          this.registrar(eventos, true);
          this.fim(eventos, "teto");
          break;
        }
        if (f.duracaoMs !== undefined) {
          this.contar(eventos);
          if (this.decorridoMs >= f.duracaoMs) this.avancar(eventos);
        } else if (f.alvoReps !== undefined && entrada.reps >= f.alvoReps) {
          this.avancar(eventos);
        }
        break;
      }
    }
    return eventos;
  }

  /** Botão "Pular": fecha a fase atual (contando o que foi feito) e segue. */
  pular(): EventoSessao[] {
    const eventos: EventoSessao[] = [];
    if (this.terminou) return eventos;
    if (this.fase.tipo === "trabalho") this.registrar(eventos, true);
    this.irPara(this.indice + 1, eventos);
    return eventos;
  }

  /** Botão "Encerrar": fecha a fase atual e termina o desafio com o que foi feito. */
  encerrar(): EventoSessao[] {
    const eventos: EventoSessao[] = [];
    if (this.terminou) return eventos;
    if (this.fase.tipo === "trabalho") this.registrar(eventos, true);
    this.fim(eventos, "encerrado");
    return eventos;
  }

  private contar(eventos: EventoSessao[]) {
    const restante = this.restanteMs;
    if (restante === null) return;
    const s = Math.ceil(restante / 1000);
    if (s !== this.ultimoSegundo) {
      this.ultimoSegundo = s;
      if (s > 0 && s <= 3) eventos.push({ tipo: "contagem", segundos: s });
    }
  }

  private avancar(eventos: EventoSessao[]) {
    if (this.fase.tipo === "trabalho") this.registrar(eventos, false);
    this.irPara(this.indice + 1, eventos);
  }

  private irPara(indice: number, eventos: EventoSessao[]) {
    if (indice >= this.linha.fases.length) {
      this.fim(eventos, "concluido");
      return;
    }
    this.indice = indice;
    this.decorridoMs = 0;
    this.contagemDesde = null;
    this.emomCumprido = false;
    this.ultimoSegundo = -1;
    this.ultimaEntrada = { ...this.ultimaEntrada, reps: 0, parciais: 0, tempoValidoMs: 0 };
    eventos.push({ tipo: "fase", indice, fase: this.fase });
  }

  private registrar(eventos: EventoSessao[], interrompida: boolean) {
    const f = this.fase;
    if (f.tipo !== "trabalho") return;
    const e = this.ultimaEntrada;
    let cumprida: boolean;
    if (f.sustentar) cumprida = f.duracaoMs !== undefined && e.tempoValidoMs >= 0.8 * f.duracaoMs;
    else if (f.alvoReps !== undefined) cumprida = e.reps >= f.alvoReps;
    else if (f.faixa) cumprida = e.reps >= f.faixa.min;
    else cumprida = e.reps > 0;
    const resultado: ResultadoFase = {
      fase: this.indice,
      exercicio: f.exercicio,
      reps: e.reps,
      parciais: e.parciais,
      tempoValidoMs: Math.round(e.tempoValidoMs),
      duracaoMs: Math.round(this.decorridoMs),
      cumprida,
      interrompida,
    };
    this.resultados.push(resultado);
    eventos.push({ tipo: "resultado", resultado });
  }

  private fim(eventos: EventoSessao[], motivo: "concluido" | "encerrado" | "teto") {
    this.terminou = true;
    eventos.push({ tipo: "fim", motivo });
  }
}

// ---------------------------------------------------------------- resumo

export interface ResumoMetodo {
  /** Linha principal do resultado, ex.: "Tabata: 96 reps". */
  titulo: string;
  /** Detalhes, ex.: "Pior round: 9 reps". */
  detalhes: string[];
}

/** Resumo do desafio pelo método (tela de resultado e KPIs enviados ao servidor). */
export function resumirMetodo(linha: LinhaDoTempo, resultados: ResultadoFase[]): { resumo: ResumoMetodo; numeros: Record<string, number> } {
  const m = linha.metodo;
  const trabalhos = linha.fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");
  const reps = resultados.reduce((s, r) => s + r.reps, 0);
  const cumpridas = resultados.filter((r) => r.cumprida).length;
  const numeros: Record<string, number> = {
    fases_total: trabalhos.length,
    fases_feitas: resultados.length,
    fases_cumpridas: cumpridas,
    reps_total: reps,
  };
  const detalhes: string[] = [];
  let titulo: string;

  switch (m.tipo) {
    case "tabata": {
      const pior = resultados.length ? Math.min(...resultados.map((r) => r.reps)) : 0;
      numeros.pior_round = pior;
      titulo = `${reps} repetições em ${resultados.length} rounds`;
      detalhes.push(`Pior round: ${pior} reps`);
      break;
    }
    case "emom":
      numeros.minutos_cumpridos = cumpridas;
      titulo = `${cumpridas} de ${m.minutos} minutos cumpridos`;
      detalhes.push(`${reps} repetições no total`);
      break;
    case "escada": {
      numeros.degraus = cumpridas;
      titulo = `${cumpridas} de ${m.degraus.length} degraus`;
      detalhes.push(`${reps} repetições no total`);
      break;
    }
    case "contra_relogio": {
      const tempo = resultados.reduce((s, r) => s + r.duracaoMs, 0) / 1000;
      const todas = cumpridas === trabalhos.length;
      numeros.tempo_total_s = Math.round(tempo);
      titulo = todas ? `Tudo feito em ${formatarTempo(tempo)}` : `${cumpridas} de ${trabalhos.length} tarefas no tempo`;
      break;
    }
    case "series":
      numeros.series_cumpridas = cumpridas;
      titulo = `${cumpridas} de ${trabalhos.length} séries completas`;
      detalhes.push(`${reps} repetições válidas`);
      break;
    case "circuito":
      titulo = `${cumpridas} de ${trabalhos.length} tarefas cumpridas`;
      if (reps > 0) detalhes.push(`${reps} repetições válidas`);
      break;
    case "intervalado": {
      if (m.meta.tipo === "sustentar") {
        const s = resultados.reduce((t, r) => t + r.tempoValidoMs, 0) / 1000;
        titulo = `${Math.round(s)} s na posição`;
        detalhes.push(`${cumpridas} de ${trabalhos.length} séries sustentadas`);
      } else {
        titulo = `${reps} repetições em ${resultados.length} séries`;
        if (m.meta.tipo === "faixa") detalhes.push(`${cumpridas} de ${trabalhos.length} séries na faixa`);
        if (resultados.length >= 2) {
          // Fadiga: queda entre a primeira e a última série do mesmo exercício (seção 8.3).
          const primeira = resultados[0];
          const ultima = [...resultados].reverse().find((r) => r.exercicio === primeira.exercicio && r !== primeira);
          if (ultima && primeira.reps > 0) {
            const queda = Math.round((100 * (primeira.reps - ultima.reps)) / primeira.reps);
            numeros.fadiga_pct = queda;
            if (queda > 0) detalhes.push(`Queda de ${queda}% entre a primeira e a última série`);
          }
        }
      }
      break;
    }
  }
  return { resumo: { titulo, detalhes }, numeros };
}

export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Método usado quando o banco ainda não tem a coluna `metodo` (antes da
 * migração 0008): um circuito de 1 rodada com o tempo de cada exercício.
 */
export function metodoLegado(segundos: number[], exercicios: ExercicioMetodo[]): Metodo {
  return { tipo: "circuito", rodadas: 1, descanso_s: 0, itens: exercicios.map((_, i) => ({ segundos: segundos[i] ?? 60 })) };
}

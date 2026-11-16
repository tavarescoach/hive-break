import { analisar, avaliarCondicao, type Contexto, type No } from "./expressao";
import { FiltroPose } from "./filtro-one-euro";
import { distancia, limitar } from "./geometria";
import { calcularKpis } from "./kpis";
import { calcularMedida, distEntre, prepararPose, type PoseMedida } from "./medidas";
import { indicesDoPonto, resolverPonto, TOTAL_PONTOS } from "./pontos";
import type {
  DefinicaoErro,
  DefinicaoExercicio,
  EstadoMotor,
  EventoMotor,
  Frame,
  Kpis,
  Lado,
  OpcoesMotor,
  RegistroRep,
} from "./tipos";
import { validarDefinicao } from "./validar-definicao";

interface FaseCompilada {
  nome: string;
  condicao: No;
  histerese: number;
  ativa: boolean;
  desde: number;
}

interface ErroCompilado {
  def: DefinicaoErro;
  condicao: No;
  histerese: number;
  ativa: boolean;
  desde: number;
  /** Já foi anunciado nesta repetição / nesta sustentação. */
  anunciado: boolean;
}

/** Intervalo máximo creditado entre dois frames (protege contra travadas). */
const DT_MAXIMO_MS = 500;

/**
 * Motor genérico de análise de movimento. Recebe uma definição de exercício
 * (dados) e frames de pose; devolve eventos e, no fim, os KPIs do bloco.
 *
 * Não guarda nem envia frames: mantém só contadores e somas.
 */
export class Motor {
  readonly def: DefinicaoExercicio;
  private readonly proporcao: number;
  private readonly visibilidadeMinima: number;
  private readonly foraQuadroMs: number;
  private readonly faseMinimaMs: number;
  private readonly duracaoMinimaMs: number;
  private readonly erroMinimoMs: number;
  private readonly obrigatorios: number[];
  private readonly filtroImagem: FiltroPose | null;
  private readonly filtroMundo: FiltroPose | null;

  // Repetições
  private readonly fases: FaseCompilada[] = [];
  private readonly sequencia: string[];
  private readonly parcialSe: No | null;
  private readonly errosDurante: ErroCompilado[] = [];
  private readonly errosFim: ErroCompilado[] = [];
  private faseAtual: string | null = null;
  private progresso = -1;
  private emExcursao = false;
  private inicioExcursao = 0;
  /** Momento em que a fase inicial foi retomada pela última vez (início do ciclo). */
  private inicioCiclo = Number.NEGATIVE_INFINITY;
  private tExtremo = 0;
  private minimos: Record<string, number> = {};
  private maximos: Record<string, number> = {};
  private errosDaRep = new Set<string>();
  private reps: RegistroRep[] = [];
  private repsValidas = 0;
  private repsParciais = 0;
  private repsRapidas = 0;

  // Sustentação
  private readonly sustCondicao: No | null;
  private readonly sustHisterese: number;
  private sustAtiva = false;
  private sustDesde = 0;
  private naPosicao = false;
  private inicioPosicao = 0;
  private tempoValidoMs = 0;
  private tempoLadoMs = { e: 0, d: 0 };
  private maiorSustentacaoMs = 0;
  private perdasPosicao = 0;
  private lado: Lado | null = null;
  // Oscilação do ponto de controle: somas do segmento atual e acumulado ponderado.
  private osc = { n: 0, sx: 0, sxx: 0, sy: 0, syy: 0 };
  private oscSomaPonderada = 0;
  private oscPesoMs = 0;

  // Tempo e quadro
  private tAnterior: number | null = null;
  private tUltimoValido: number | null = null;
  private foraDoQuadro = false;
  private frameValido = false;
  private tempoTrabalhoMs = 0;
  private tempoForaMs = 0;
  private medidas: Record<string, number> = {};
  private contagemErros: Record<string, number> = {};

  constructor(def: DefinicaoExercicio, opcoes: OpcoesMotor = {}) {
    const problemas = validarDefinicao(def);
    if (problemas.length) throw new Error(`Definição inválida de "${def.id}":\n- ${problemas.join("\n- ")}`);

    this.def = def;
    this.proporcao = opcoes.proporcao ?? 1;
    this.visibilidadeMinima = opcoes.visibilidadeMinima ?? 0.6;
    this.foraQuadroMs = opcoes.foraQuadroMs ?? 1000;
    this.faseMinimaMs = def.fase_minima_ms ?? 150;
    this.duracaoMinimaMs = def.duracao_minima_ms ?? 400;
    this.erroMinimoMs = def.erro_minimo_ms ?? 150;
    this.obrigatorios = [...new Set(def.pontos_obrigatorios.flatMap(indicesDoPonto))];
    const suavizar = opcoes.suavizar ?? true;
    this.filtroImagem = suavizar ? new FiltroPose(TOTAL_PONTOS) : null;
    this.filtroMundo = suavizar ? new FiltroPose(TOTAL_PONTOS) : null;

    const histerese = def.histerese ?? 5;
    for (const fase of def.fases ?? []) {
      this.fases.push({
        nome: fase.nome,
        condicao: analisar(fase.condicao),
        histerese: fase.histerese ?? histerese,
        ativa: false,
        desde: 0,
      });
    }
    this.sequencia = def.repeticao ?? [];
    this.parcialSe = def.parcial_se ? analisar(def.parcial_se) : null;
    for (const erro of def.erros ?? []) {
      const compilado: ErroCompilado = {
        def: erro,
        condicao: analisar(erro.condicao),
        histerese: erro.histerese ?? 0,
        ativa: false,
        desde: 0,
        anunciado: false,
      };
      (erro.quando === "fim_rep" ? this.errosFim : this.errosDurante).push(compilado);
    }
    this.sustCondicao = def.sustentacao ? analisar(def.sustentacao.condicao) : null;
    this.sustHisterese = def.sustentacao?.histerese ?? histerese;
  }

  /** Processa um frame e devolve os eventos gerados por ele. */
  processar(frame: Frame): EventoMotor[] {
    const eventos: EventoMotor[] = [];
    const t = frame.t;
    const dt = this.tAnterior === null ? 0 : limitar(t - this.tAnterior, 0, DT_MAXIMO_MS);
    this.tAnterior = t;
    this.tempoTrabalhoMs += dt;
    if (this.tUltimoValido === null) this.tUltimoValido = t;

    const pontos = frame.pontos;
    const visivel =
      !!pontos &&
      pontos.length >= TOTAL_PONTOS &&
      this.obrigatorios.every((i) => (pontos[i].visibility ?? 1) >= this.visibilidadeMinima);

    if (!visivel || !pontos) {
      this.frameValido = false;
      this.tempoForaMs += dt;
      if (!this.foraDoQuadro && t - this.tUltimoValido >= this.foraQuadroMs) {
        this.foraDoQuadro = true;
        this.interromper(t, eventos);
        eventos.push({ tipo: "fora_quadro", t });
      }
      return eventos;
    }

    this.frameValido = true;
    this.tUltimoValido = t;
    if (this.foraDoQuadro) {
      this.foraDoQuadro = false;
      eventos.push({ tipo: "voltou_quadro", t });
    }

    const imagem = this.filtroImagem ? this.filtroImagem.filtrar(pontos, t) : pontos;
    const mundo = frame.mundo ? (this.filtroMundo ? this.filtroMundo.filtrar(frame.mundo, t) : frame.mundo) : null;
    const pose = prepararPose(imagem, mundo, this.proporcao);

    const medidas: Record<string, number> = { medida: calcularMedida(this.def.medida_principal, pose) };
    for (const [nome, def] of Object.entries(this.def.medidas ?? {})) medidas[nome] = calcularMedida(def, pose);
    this.medidas = medidas;

    const ctx: Contexto = {
      variavel: (nome) => {
        if (nome in medidas) return medidas[nome];
        if (nome.startsWith("min_")) return this.minimos[nome.slice(4)] ?? NaN;
        if (nome.startsWith("max_")) return this.maximos[nome.slice(4)] ?? NaN;
        return NaN;
      },
      dist: (nomes) => distEntre(nomes, pose),
    };

    if (this.def.formato === "repeticoes") this.processarRepeticoes(t, ctx, eventos);
    else this.processarSustentacao(t, dt, ctx, pose, eventos);

    this.processarErrosDurante(t, ctx, eventos);
    return eventos;
  }

  // ---------------------------------------------------------------- repetições

  private processarRepeticoes(t: number, ctx: Contexto, eventos: EventoMotor[]): void {
    for (const fase of this.fases) {
      const ativa = avaliarCondicao(fase.condicao, ctx, fase.ativa ? fase.histerese : 0);
      if (ativa && !fase.ativa) fase.desde = t;
      fase.ativa = ativa;
    }

    // 1. Confirma uma fase nova quando ela dura o mínimo exigido.
    const nova = this.fases.find((f) => f.ativa && f.nome !== this.faseAtual && t - f.desde >= this.faseMinimaMs);
    if (nova) {
      this.faseAtual = nova.nome;
      eventos.push({ tipo: "fase", t, fase: nova.nome });
      if (this.progresso < 0) {
        if (nova.nome === this.sequencia[0]) this.progresso = 0;
      } else if (this.sequencia[this.progresso + 1] === nova.nome) {
        this.progresso++;
      }
    }

    // 2. Acompanha o movimento: começa ao sair da fase inicial e fecha ao voltar.
    const inicial = this.fases.find((f) => f.nome === this.sequencia[0])!;
    if (!this.emExcursao) {
      if (this.progresso === 0 && this.faseAtual === inicial.nome && !inicial.ativa) {
        this.emExcursao = true;
        this.inicioExcursao = t;
        this.tExtremo = t;
        this.minimos = { ...this.medidas };
        this.maximos = { ...this.medidas };
        this.errosDaRep.clear();
        for (const erro of this.errosDurante) erro.anunciado = false;
      }
      return;
    }

    this.atualizarExtremos(t);

    const voltou = inicial.ativa && inicial.desde > this.inicioExcursao && t - inicial.desde >= this.faseMinimaMs;
    if (voltou) {
      const completa = this.progresso === this.sequencia.length - 1;
      this.fecharRepeticao(completa, inicial.desde, ctx, eventos);
      this.emExcursao = false;
      this.progresso = 0;
      this.inicioCiclo = inicial.desde;
    }
  }

  private atualizarExtremos(t: number): void {
    const usaMaximo = this.def.amplitude?.extremo === "max";
    for (const [nome, valor] of Object.entries(this.medidas)) {
      if (Number.isNaN(valor)) continue;
      if (!(valor >= this.minimos[nome])) {
        this.minimos[nome] = valor;
        if (nome === "medida" && !usaMaximo) this.tExtremo = t;
      }
      if (!(valor <= this.maximos[nome])) {
        this.maximos[nome] = valor;
        if (nome === "medida" && usaMaximo) this.tExtremo = t;
      }
    }
  }

  private fecharRepeticao(completa: boolean, tFim: number, ctx: Contexto, eventos: EventoMotor[]): void {
    const duracaoMs = tFim - this.inicioExcursao;
    const usaMaximo = this.def.amplitude?.extremo === "max";
    const extremo = usaMaximo ? this.maximos.medida : this.minimos.medida;
    const tExtremo = limitar(this.tExtremo, this.inicioExcursao, tFim);
    const amp = this.def.amplitude;
    const amplitude = amp ? limitar((extremo - amp.minimo_aceito) / (amp.ideal - amp.minimo_aceito), 0, 1) : null;

    const rep: RegistroRep = {
      t: tFim,
      valida: false,
      duracaoMs,
      tempoIdaMs: tExtremo - this.inicioExcursao,
      tempoVoltaMs: tFim - tExtremo,
      extremo,
      amplitude,
      erros: [...this.errosDaRep],
    };

    // Ciclo completo: desde a última vez que a pessoa chegou à posição inicial.
    const cicloMs = tFim - this.inicioCiclo;

    if (!completa) {
      // Voltou ao início sem passar por todas as fases: parcial ou só um tremor.
      const parcial = this.parcialSe !== null && cicloMs >= this.duracaoMinimaMs && avaliarCondicao(this.parcialSe, ctx);
      if (!parcial) return;
      rep.motivo = "amplitude";
      rep.amplitude = amp ? 0 : null;
      this.registrarParcial(rep, tFim, this.def.parcial_feedback, eventos);
      return;
    }

    // Antifraude: repetição mais rápida que o limite humano não conta.
    if (cicloMs < this.duracaoMinimaMs) {
      rep.motivo = "rapida";
      this.repsRapidas++;
      eventos.push({ tipo: "rep_rapida", t: tFim, rep });
      return;
    }

    let invalidante: DefinicaoErro | null = null;
    for (const erro of this.errosFim) {
      if (!avaliarCondicao(erro.condicao, ctx)) continue;
      rep.erros.push(erro.def.id);
      this.contarErro(erro.def.id);
      if (erro.def.invalida) invalidante ??= erro.def;
      else eventos.push({ tipo: "erro", t: tFim, id: erro.def.id, feedback: erro.def.feedback });
    }

    if (invalidante) {
      rep.motivo = invalidante.id;
      this.registrarParcial(rep, tFim, invalidante.feedback, eventos);
      return;
    }

    rep.valida = true;
    this.reps.push(rep);
    this.repsValidas++;
    eventos.push({ tipo: "rep_valida", t: tFim, total: this.repsValidas, rep });
  }

  private registrarParcial(rep: RegistroRep, t: number, feedback: string | undefined, eventos: EventoMotor[]): void {
    this.reps.push(rep);
    this.repsParciais++;
    eventos.push({ tipo: "rep_parcial", t, total: this.repsParciais, rep, feedback });
  }

  // --------------------------------------------------------------- sustentação

  private processarSustentacao(t: number, dt: number, ctx: Contexto, pose: PoseMedida, eventos: EventoMotor[]): void {
    const sust = this.def.sustentacao!;
    const ativa = avaliarCondicao(this.sustCondicao!, ctx, this.sustAtiva ? this.sustHisterese : 0);
    if (ativa && !this.sustAtiva) this.sustDesde = t;
    this.sustAtiva = ativa;

    if (!ativa) {
      if (this.naPosicao) this.encerrarPosicao(t, sust.feedback_perda, eventos);
      return;
    }

    if (sust.lado) {
      const valor = this.medidas[sust.lado.medida];
      if (valor > 0) this.lado = sust.lado.positivo;
      else if (valor < 0) this.lado = sust.lado.negativo;
    }

    if (!this.naPosicao) {
      if (t - this.sustDesde < this.faseMinimaMs) return;
      // Confirmou: credita o tempo desde que entrou na posição.
      this.naPosicao = true;
      this.inicioPosicao = this.sustDesde;
      this.osc = { n: 0, sx: 0, sxx: 0, sy: 0, syy: 0 };
      for (const erro of this.errosDurante) erro.anunciado = false;
      this.creditarTempo(t - this.sustDesde);
      eventos.push({ tipo: "posicao_inicio", t, lado: this.lado });
    } else {
      this.creditarTempo(dt);
    }

    if (sust.controle) {
      const ref = resolverPonto(sust.controle.ponto);
      const p =
        ref.tipo === "unico"
          ? pose.imagem[ref.indice]
          : {
              x: (pose.imagem[ref.e].x + pose.imagem[ref.d].x) / 2,
              y: (pose.imagem[ref.e].y + pose.imagem[ref.d].y) / 2,
              z: 0,
            };
      const [a, b] = sust.controle.normalizar_por;
      const escala = distancia(this.pontoMedioNome(pose, a), this.pontoMedioNome(pose, b));
      if (escala > 1e-6) {
        const x = p.x / escala;
        const y = p.y / escala;
        this.osc.n++;
        this.osc.sx += x;
        this.osc.sxx += x * x;
        this.osc.sy += y;
        this.osc.syy += y * y;
      }
    }
  }

  private pontoMedioNome(pose: PoseMedida, nome: string) {
    const ref = resolverPonto(nome);
    if (ref.tipo === "unico") return pose.imagem[ref.indice];
    const e = pose.imagem[ref.e];
    const d = pose.imagem[ref.d];
    return { x: (e.x + d.x) / 2, y: (e.y + d.y) / 2, z: 0 };
  }

  private creditarTempo(ms: number): void {
    this.tempoValidoMs += ms;
    if (this.lado) this.tempoLadoMs[this.lado] += ms;
  }

  private oscilacaoSegmento(): number | null {
    const { n, sx, sxx, sy, syy } = this.osc;
    if (n < 5) return null;
    const varX = Math.max(0, sxx / n - (sx / n) ** 2);
    const varY = Math.max(0, syy / n - (sy / n) ** 2);
    return Math.sqrt(varX + varY);
  }

  private encerrarPosicao(t: number, feedback: string | undefined, eventos: EventoMotor[]): void {
    const duracaoMs = t - this.inicioPosicao;
    this.naPosicao = false;
    this.perdasPosicao++;
    this.maiorSustentacaoMs = Math.max(this.maiorSustentacaoMs, duracaoMs);
    const osc = this.oscilacaoSegmento();
    if (osc !== null) {
      this.oscSomaPonderada += osc * duracaoMs;
      this.oscPesoMs += duracaoMs;
    }
    this.osc = { n: 0, sx: 0, sxx: 0, sy: 0, syy: 0 };
    eventos.push({ tipo: "posicao_perdida", t, lado: this.lado, duracaoMs, feedback });
  }

  // --------------------------------------------------------------------- erros

  private processarErrosDurante(t: number, ctx: Contexto, eventos: EventoMotor[]): void {
    const emAcao = this.def.formato === "repeticoes" ? this.emExcursao : this.naPosicao;
    for (const erro of this.errosDurante) {
      const aplicavel = !erro.def.fase || erro.def.fase === this.faseAtual;
      const ativa = aplicavel && avaliarCondicao(erro.condicao, ctx, erro.ativa ? erro.histerese : 0);
      if (ativa && !erro.ativa) erro.desde = t;
      erro.ativa = ativa;
      if (ativa && emAcao && !erro.anunciado && t - erro.desde >= this.erroMinimoMs) {
        erro.anunciado = true;
        this.errosDaRep.add(erro.def.id);
        this.contarErro(erro.def.id);
        eventos.push({ tipo: "erro", t, id: erro.def.id, feedback: erro.def.feedback });
      }
    }
  }

  private contarErro(id: string): void {
    this.contagemErros[id] = (this.contagemErros[id] ?? 0) + 1;
  }

  /** Corpo saiu do quadro: abandona o movimento em curso sem pontuar. */
  private interromper(t: number, eventos: EventoMotor[]): void {
    this.emExcursao = false;
    this.faseAtual = null;
    this.progresso = -1;
    this.inicioCiclo = Number.NEGATIVE_INFINITY;
    for (const fase of this.fases) fase.ativa = false;
    for (const erro of this.errosDurante) erro.ativa = false;
    this.sustAtiva = false;
    if (this.naPosicao) this.encerrarPosicao(this.tUltimoValido ?? t, undefined, eventos);
    this.filtroImagem?.reiniciar();
    this.filtroMundo?.reiniciar();
  }

  // -------------------------------------------------------------------- saídas

  get estado(): EstadoMotor {
    const errosAtivos = this.errosDurante
      .filter((e) => e.ativa && (this.tAnterior ?? 0) - e.desde >= this.erroMinimoMs)
      .map((e) => e.def.id);
    return {
      repsValidas: this.repsValidas,
      repsParciais: this.repsParciais,
      repsRapidas: this.repsRapidas,
      tempoValidoMs: this.tempoValidoMs,
      fase: this.faseAtual,
      naPosicao: this.naPosicao,
      lado: this.lado,
      foraDoQuadro: this.foraDoQuadro,
      frameValido: this.frameValido,
      errosAtivos,
      medidas: this.medidas,
    };
  }

  /** KPIs do bloco até agora (seção 8.3). São só números agregados. */
  kpis(): Kpis {
    let somaOsc = this.oscSomaPonderada;
    let pesoOsc = this.oscPesoMs;
    let maior = this.maiorSustentacaoMs;
    if (this.naPosicao && this.tAnterior !== null) {
      const duracao = this.tAnterior - this.inicioPosicao;
      maior = Math.max(maior, duracao);
      const osc = this.oscilacaoSegmento();
      if (osc !== null) {
        somaOsc += osc * duracao;
        pesoOsc += duracao;
      }
    }
    return calcularKpis({
      reps: this.reps,
      repsRapidas: this.repsRapidas,
      tempoTrabalhoMs: this.tempoTrabalhoMs,
      tempoForaMs: this.tempoForaMs,
      tempoValidoMs: this.tempoValidoMs,
      tempoValidoLadoMs: { ...this.tempoLadoMs },
      maiorSustentacaoMs: maior,
      perdasPosicao: this.perdasPosicao,
      oscilacao: pesoOsc > 0 ? somaOsc / pesoOsc : null,
      oscilacaoMaxima: this.def.sustentacao?.controle?.oscilacao_maxima ?? null,
      erros: this.contagemErros,
    });
  }
}

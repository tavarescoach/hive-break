import { analisar, avaliarCondicao, type Contexto, type No } from "./expressao";
import { FiltroPose } from "./filtro-one-euro";
import { distancia, limitar, type Vetor } from "./geometria";
import { calcularKpis } from "./kpis";
import { calcularMedida, distEntre, prepararPose, visibilidadeDe, type PoseMedida } from "./medidas";
import { gruposObrigatorios, indicesDoPonto, resolverPonto, TOTAL_PONTOS } from "./pontos";
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
  /** Índices dos pontos de `def.pontos` (vazio quando o erro não define segmento). */
  pontosIdx: number[];
}

interface LadoAlternado {
  lado: Lado;
  condicao: No;
  quase: No | null;
  ativa: boolean;
  desde: number;
  /** Pode contar de novo (a condição deixou de valer depois da última repetição). */
  armado: boolean;
  quaseAtiva: boolean;
  /** Começou o movimento ("quase") sem ainda ter contado repetição. */
  tentou: boolean;
}

interface Alvo {
  /** Posição na imagem, com x já corrigido pela proporção. */
  x: number;
  y: number;
  raio: number;
  nasceu: number;
}

/**
 * Visibilidade mínima dos pontos obrigatórios. A especificação sugeria 0,6; o
 * teste com pessoas reais (18/11/2026) mostrou que isso deixava o corpo "fora do
 * quadro" com frequência em casa, então o padrão ficou mais tolerante.
 */
export const VISIBILIDADE_MINIMA_PADRAO = 0.5;

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
  private readonly obrigatorios: number[][];
  private readonly aleatorio: () => number;

  // Alternado
  private readonly lados: LadoAlternado[] = [];
  private ultimaRep = Number.NEGATIVE_INFINITY;

  // Precisão (alvos)
  private readonly pontosAlvo: number[] = [];
  private alvo: Alvo | null = null;
  private proximoAlvoEm = 0;
  private acertos = 0;
  private alvosPerdidos = 0;
  private somaReacaoMs = 0;

  // Medida "movimento"
  private poseAnterior: { t: number; imagem: Vetor[] } | null = null;
  private movimento: Record<string, number> = {};
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
    this.visibilidadeMinima = opcoes.visibilidadeMinima ?? VISIBILIDADE_MINIMA_PADRAO;
    this.foraQuadroMs = opcoes.foraQuadroMs ?? 1000;
    this.faseMinimaMs = def.fase_minima_ms ?? 150;
    this.duracaoMinimaMs = def.duracao_minima_ms ?? 400;
    this.erroMinimoMs = def.erro_minimo_ms ?? 150;
    this.obrigatorios = gruposObrigatorios(def.pontos_obrigatorios);
    this.aleatorio = opcoes.aleatorio ?? Math.random;
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
        pontosIdx: (erro.pontos ?? []).flatMap(indicesDoPonto),
      };
      (erro.quando === "fim_rep" ? this.errosFim : this.errosDurante).push(compilado);
    }
    if (def.alternado) {
      for (const lado of ["e", "d"] as const) {
        const quase = def.alternado[`quase_${lado}`];
        this.lados.push({
          lado,
          condicao: analisar(def.alternado[lado]),
          quase: quase ? analisar(quase) : null,
          ativa: false,
          desde: 0,
          // Só conta depois de ver a pessoa em repouso: quem já começa com o
          // joelho no alto não ganha uma repetição de graça.
          armado: false,
          quaseAtiva: false,
          tentou: false,
        });
      }
    }
    if (def.alvos) this.pontosAlvo.push(...def.alvos.pontos.flatMap(indicesDoPonto));
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
      this.obrigatorios.every((grupo) => grupo.some((i) => (pontos[i].visibility ?? 1) >= this.visibilidadeMinima));

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
    this.medirMovimento(t, pose, medidas);
    this.medidas = medidas;

    const ctx: Contexto = {
      variavel: (nome) => {
        if (nome in medidas) return medidas[nome];
        if (nome.startsWith("min_")) return this.minimos[nome.slice(4)] ?? NaN;
        if (nome.startsWith("max_")) return this.maximos[nome.slice(4)] ?? NaN;
        return NaN;
      },
      dist: (nomes) => distEntre(nomes, pose),
      vis: (nome) => visibilidadeDe(nome, pose),
    };

    if (this.def.formato === "repeticoes") this.processarRepeticoes(t, ctx, eventos);
    else if (this.def.formato === "alternado") this.processarAlternado(t, ctx, eventos);
    else if (this.def.formato === "precisao") this.processarAlvos(t, pose, eventos);
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

  // ----------------------------------------------------------------- alternado

  private processarAlternado(t: number, ctx: Contexto, eventos: EventoMotor[]): void {
    const histerese = this.def.histerese ?? 5;
    for (const l of this.lados) {
      const ativa = avaliarCondicao(l.condicao, ctx, l.ativa ? histerese : 0);
      if (ativa && !l.ativa) l.desde = t;
      l.ativa = ativa;

      if (ativa && l.armado && t - l.desde >= this.faseMinimaMs) {
        l.armado = false;
        l.tentou = false;
        const rep: RegistroRep = {
          t, valida: false, lado: l.lado, duracaoMs: t - l.desde, tempoIdaMs: 0, tempoVoltaMs: 0,
          extremo: NaN, amplitude: null, erros: [...this.errosDaRep],
        };
        this.errosDaRep.clear();
        for (const erro of this.errosDurante) erro.anunciado = false;
        // Antifraude: repetições mais rápidas que o limite humano não contam.
        if (t - this.ultimaRep < this.duracaoMinimaMs) {
          rep.motivo = "rapida";
          this.repsRapidas++;
          eventos.push({ tipo: "rep_rapida", t, rep });
        } else {
          rep.valida = true;
          this.reps.push(rep);
          this.repsValidas++;
          this.lado = l.lado;
          eventos.push({ tipo: "rep_valida", t, total: this.repsValidas, rep });
        }
        this.ultimaRep = t;
      }
      if (!ativa) l.armado = true;

      if (l.quase) {
        const quase = avaliarCondicao(l.quase, ctx, l.quaseAtiva ? histerese : 0);
        if (quase && !l.quaseAtiva && l.armado) l.tentou = true;
        // Baixou sem ter chegado lá: repetição parcial.
        if (!quase && l.quaseAtiva && l.tentou) {
          l.tentou = false;
          this.registrarParcial(
            { t, valida: false, lado: l.lado, motivo: "amplitude", duracaoMs: 0, tempoIdaMs: 0, tempoVoltaMs: 0, extremo: NaN, amplitude: null, erros: [] },
            t, this.def.parcial_feedback, eventos,
          );
        }
        l.quaseAtiva = quase;
      }
    }
  }

  // ------------------------------------------------------------------ precisão

  private processarAlvos(t: number, pose: PoseMedida, eventos: EventoMotor[]): void {
    const cfg = this.def.alvos!;
    const oe = pose.imagem[11];
    const od = pose.imagem[12];
    const largura = distancia(oe, od);
    if (largura < 1e-6) return;

    if (!this.alvo) {
      if (t < this.proximoAlvoEm) return;
      // Alvo ao alcance das mãos: ao lado e acima dos ombros, de um lado ou de outro.
      const lado = this.aleatorio() < 0.5 ? -1 : 1;
      const x = (oe.x + od.x) / 2 + lado * largura * (0.9 + 0.8 * this.aleatorio());
      const y = (oe.y + od.y) / 2 + largura * (-1.3 + 1.9 * this.aleatorio());
      const margem = cfg.raio * largura;
      this.alvo = {
        x: limitar(x, margem, this.proporcao - margem),
        y: limitar(y, margem, 1 - margem),
        raio: margem,
        nasceu: t,
      };
      return;
    }

    const alvo = this.alvo;
    const acertou = this.pontosAlvo.some((i) => Math.hypot(pose.imagem[i].x - alvo.x, pose.imagem[i].y - alvo.y) <= alvo.raio);
    if (acertou) {
      this.acertos++;
      this.repsValidas++;
      this.somaReacaoMs += t - alvo.nasceu;
      eventos.push({ tipo: "alvo_acerto", t, total: this.acertos, reacaoMs: t - alvo.nasceu });
    } else if (t - alvo.nasceu > cfg.tempo_ms) {
      this.alvosPerdidos++;
      eventos.push({ tipo: "alvo_perdido", t });
    } else {
      return;
    }
    this.alvo = null;
    this.proximoAlvoEm = t + (cfg.intervalo_ms ?? 500);
  }

  // ----------------------------------------------------------------- movimento

  /** Calcula as medidas do tipo "movimento": velocidade média dos pontos, suavizada. */
  private medirMovimento(t: number, pose: PoseMedida, medidas: Record<string, number>): void {
    const todas: [string, DefinicaoExercicio["medida_principal"]][] = [
      ["medida", this.def.medida_principal],
      ...Object.entries(this.def.medidas ?? {}),
    ];
    const anterior = this.poseAnterior;
    for (const [nome, def] of todas) {
      if (def.tipo !== "movimento") continue;
      const dt = anterior ? (t - anterior.t) / 1000 : 0;
      if (!anterior || dt <= 0 || dt > 0.5) {
        medidas[nome] = this.movimento[nome] ?? 0;
        continue;
      }
      const escala = distancia(this.pontoMedioNome(pose, def.normalizar_por[0]), this.pontoMedioNome(pose, def.normalizar_por[1]));
      const indices = def.pontos.flatMap(indicesDoPonto);
      const media = indices.reduce((s, i) => s + distancia(pose.imagem[i], anterior.imagem[i]), 0) / indices.length;
      const velocidade = escala > 1e-6 ? media / escala / dt : 0;
      // Média móvel exponencial com constante de tempo de meio segundo.
      const alfa = 1 - Math.exp(-dt / 0.5);
      const suave = (this.movimento[nome] ?? velocidade) + alfa * (velocidade - (this.movimento[nome] ?? velocidade));
      this.movimento[nome] = suave;
      medidas[nome] = suave;
    }
    this.poseAnterior = { t, imagem: pose.imagem };
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
    const emAcao =
      this.def.formato === "repeticoes" ? this.emExcursao : this.def.formato === "alternado" ? true : this.naPosicao;
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
    for (const l of this.lados) Object.assign(l, { ativa: false, armado: false, quaseAtiva: false, tentou: false });
    this.alvo = null;
    this.poseAnterior = null;
    if (this.naPosicao) this.encerrarPosicao(this.tUltimoValido ?? t, undefined, eventos);
    this.filtroImagem?.reiniciar();
    this.filtroMundo?.reiniciar();
  }

  // -------------------------------------------------------------------- saídas

  get estado(): EstadoMotor {
    const ativos = this.errosDurante.filter((e) => e.ativa && (this.tAnterior ?? 0) - e.desde >= this.erroMinimoMs);
    const errosAtivos = ativos.map((e) => e.def.id);
    // Esqueleto só pinta o segmento certo quando TODO erro ativo define `pontos`;
    // senão (ex.: erro de amplitude sem segmento claro) a tela cai no esqueleto inteiro.
    const segmentoErro = ativos.length > 0 && ativos.every((e) => e.pontosIdx.length > 0) ? [...new Set(ativos.flatMap((e) => e.pontosIdx))] : [];
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
      segmentoErro,
      medidas: this.medidas,
      alvo: this.alvo ? { x: this.alvo.x / this.proporcao, y: this.alvo.y, raio: this.alvo.raio } : null,
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
      acertos: this.acertos,
      alvosPerdidos: this.alvosPerdidos,
      somaReacaoMs: this.somaReacaoMs,
    });
  }
}

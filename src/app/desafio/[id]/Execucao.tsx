"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AvisosHive, FaixaHive, useHive } from "@/app/hive/AoVivo";
import { abrirCameraFrontal, fecharCamera } from "@/camera/camera";
import { acompanharVideo, desenharAlvo, desenharEsqueleto } from "@/camera/desenhar-esqueleto";
import { criarDetector, type Detector } from "@/camera/pose";
import { som } from "@/camera/som";
import { calarVoz, falar } from "@/camera/voz";
import { Gabarito, dicaDoGabarito } from "@/componentes/Gabarito";
import { agregarPorExercicio, type BlocoEnviado } from "@/dominio/agregar";
import {
  descreverBloco, descreverScore, duracaoManualMs, etiquetasDoBloco, explicarCadencia, formatarTempo, metaManual, resumir, SessaoTreino,
  type Bloco, type EventoSessao, type ExercicioMetodo, type Fase, type FaseTrabalho, type LinhaDoTempo,
} from "@/dominio/metodos";
import { ehSustentacao, exercicioPorId } from "@/exercicios";
import { registrarEvento, registrarPrimeiraRepSeNecessario } from "@/lib/eventos";
import { Motor, VISIBILIDADE_MINIMA_PADRAO } from "@/motor/motor";
import { avaliarEnquadramento } from "@/motor/enquadramento";
import { gruposObrigatorios } from "@/motor/pontos";
import type { DefinicaoExercicio, EventoMotor, Frame, Kpis } from "@/motor/tipos";
import { registrarDor } from "./acoes";
import type { BlocoDesafio, FimDoDesafio } from "./Desafio";

const VISIBILIDADE_MINIMA = VISIBILIDADE_MINIMA_PADRAO;
const REGIOES = [
  ["joelho", "Joelho"], ["ombro", "Ombro"], ["lombar", "Lombar"], ["punho", "Punho"],
  ["quadril", "Quadril"], ["tornozelo", "Tornozelo"], ["pescoco", "Pescoço"], ["outra", "Outro lugar"],
] as const;

type EstadoRep = "valida" | "parcial";

interface Indicador {
  rotulo: string;
  valor: string;
  bom: boolean;
}

/** Modo sem câmera: pergunta opcional "Quantas você fez?" ao fim de uma série (seção 6 do pedido). */
interface PerguntaManual {
  id: number;
  faseIndice: number;
  exercicio: string;
  reps: number;
}

interface Hud {
  carregando: boolean;
  indice: number;
  restanteMs: number | null;
  restanteTetoMs: number | null;
  progresso: number;
  reps: number;
  parciais: number;
  tempoValidoMs: number;
  naPosicao: boolean;
  emomCumprido: boolean;
  /** Aviso de correção em voga (coral, centro da tela, 1,5 s — docs/HUD_TREINO.md seção 6). */
  feedback: string | null;
  fora: boolean;
  corpoVisivel: boolean;
  /** Amplitude/ritmo/técnica da série que acabou. Só aparecem no descanso (seção 5). */
  kpisDescanso: Indicador[];
  /** Último aviso de técnica da série anterior, mostrado como dica no descanso. */
  dicaCorrecao: string | null;
  /** Estado de cada repetição da meta (para a barra/moldura segmentada). */
  segmentosRep: EstadoRep[];
  ultimoResultado: string | null;
  lento: boolean;
  /** Aviso de posicionamento (o que a câmera não vê e como corrigir). */
  enquadramento: string | null;
}

const HUD_INICIAL: Hud = {
  carregando: true, indice: 0, restanteMs: null, restanteTetoMs: null, progresso: 0, reps: 0, parciais: 0,
  tempoValidoMs: 0, naPosicao: false, emomCumprido: false, feedback: null, fora: false, corpoVisivel: false,
  kpisDescanso: [], dicaCorrecao: null, segmentosRep: [], ultimoResultado: null, lento: false, enquadramento: null,
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** Tempo em m:ss, arredondando para cima (contagem regressiva). */
const regressivo = (ms: number) => formatarTempo(Math.ceil(ms / 1000));

/** Dois ou três KPIs da série que acabou (seção 8.3), mostrados só no descanso. */
function indicadores(def: DefinicaoExercicio, k: Kpis): Indicador[] {
  const lista: Indicador[] = [];
  if (def.formato === "precisao") {
    if (k.precisao !== null) lista.push({ rotulo: "Precisão", valor: pct(k.precisao), bom: k.precisao >= 0.7 });
    if (k.tempo_reacao !== null) lista.push({ rotulo: "Reação", valor: `${k.tempo_reacao.toFixed(1).replace(".", ",")} s`, bom: k.tempo_reacao <= 1.2 });
  } else if (ehSustentacao(def)) {
    if (k.pct_tempo_valido !== null) lista.push({ rotulo: def.formato === "respiracao" ? "Parado" : "Na posição", valor: pct(k.pct_tempo_valido), bom: k.pct_tempo_valido >= 0.7 });
    if (k.estabilidade !== null) lista.push({ rotulo: "Estabilidade", valor: pct(k.estabilidade), bom: k.estabilidade >= 0.7 });
  } else {
    if (k.amplitude_media !== null) lista.push({ rotulo: "Amplitude", valor: pct(k.amplitude_media), bom: k.amplitude_media >= 0.5 });
    if (k.cadencia !== null) lista.push({ rotulo: "Ritmo", valor: `${Math.round(k.cadencia)}/min`, bom: true });
    if (k.indice_tecnico !== null) lista.push({ rotulo: "Técnica", valor: pct(k.indice_tecnico), bom: k.indice_tecnico >= 0.8 });
    else if (k.simetria !== null) lista.push({ rotulo: "Simetria", valor: pct(k.simetria), bom: k.simetria >= 0.8 });
  }
  return lista.slice(0, 3);
}

/**
 * Legenda curta sob o número hero (meta da faixa, parciais, minuto cumprido…).
 * Sem câmera (`manual`), o hero vira sempre um regressivo (`duracaoManualMs`):
 * a legenda mostra a meta da série ("Meta: N repetições") ou, nos blocos por
 * tempo sem meta de reps, "Mantenha o ritmo" (seção 2 do pedido).
 */
function legendaHero(fase: FaseTrabalho, hud: Hud, manual: boolean): string | null {
  if (fase.sustentar) return hud.naPosicao ? null : "Entre na posição do gabarito";
  if (fase.emom && hud.emomCumprido) return "Minuto cumprido · descanse até o próximo";
  if (fase.faixa) return `Meta: ${fase.faixa.min} a ${fase.faixa.max} repetições`;
  if (hud.parciais > 0 && fase.duracaoMs === undefined && !manual) return `${hud.parciais} ${hud.parciais === 1 ? "parcial" : "parciais"} (não contam)`;
  if (manual) {
    if (fase.emom && fase.alvoReps !== undefined) return `Meta: ${fase.alvoReps} repetições no minuto`;
    if (fase.duracaoMs === undefined) return `Meta: ${fase.alvoReps ?? 0} repetições`;
    return "Mantenha o ritmo";
  }
  return null;
}

interface Props {
  id: string;
  blocos: BlocoDesafio[];
  exercicios: ExercicioMetodo[];
  linha: LinhaDoTempo;
  comCamera: boolean;
  /** Visual do HUD de treino: "barra" (padrão) ou "moldura" (docs/HUD_TREINO.md). */
  estiloProgresso: "barra" | "moldura";
  /** Fim do desafio: números por bloco (vazio no modo sem câmera), resumo geral e por série. */
  aoFim: (fim: FimDoDesafio) => void;
  /** A câmera não abriu: a tela troca para o modo sem câmera. */
  aoSemCamera: (mensagem: string) => void;
}

/**
 * Execução do desafio: percorre as fases do método (preparo, trabalho,
 * descanso, transição) com a câmera contando, ou com o timer e o botão "Feito"
 * no modo sem câmera. O vídeo é analisado no aparelho. O HUD segue
 * docs/HUD_TREINO.md: nunca dois números grandes lado a lado.
 */
export function Execucao({ id, blocos, exercicios, linha, comCamera, estiloProgresso, aoFim, aoSemCamera }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const telaRef = useRef<HTMLDivElement>(null);
  const sessaoRef = useRef<SessaoTreino>(null);
  const pausadoRef = useRef(false);
  const vozDesligadaRef = useRef(false);
  const manualRepsRef = useRef(0);
  const acaoRef = useRef<(qual: "pular" | "encerrar" | "contarRep") => void>(() => {});
  const timerOverlayRef = useRef<number | undefined>(undefined);
  const [hud, setHud] = useState<Hud>(HUD_INICIAL);
  const [modal, setModal] = useState<"dor" | "sair" | null>(null);
  const [enviandoDor, setEnviandoDor] = useState(false);
  const [overlayAberto, setOverlayAberto] = useState(false);
  const [pausadoUI, setPausadoUI] = useState(false);
  const [vozDesligada, setVozDesligada] = useState(false);
  const [tela, setTela] = useState({ w: 0, h: 0 });
  /** Modo sem câmera: pergunta opcional "Quantas você fez?" (seção 6 do pedido). */
  const [perguntaManual, setPerguntaManual] = useState<PerguntaManual | null>(null);
  const entregar = useEffectEvent(aoFim);
  const semCamera = useEffectEvent(aoSemCamera);
  const hive = useHive();
  const repsPorFaseRef = useRef(new Map<number, number>());

  // Mede a tela para desenhar a moldura (borda) de progresso no tamanho certo.
  useEffect(() => {
    const el = telaRef.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect;
      setTela({ w: Math.round(width), h: Math.round(height) });
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const sessao = new SessaoTreino(linha);
    sessaoRef.current = sessao;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;
    const defs = blocos.map((b) => exercicioPorId(b.exercicioId) ?? null);

    let cancelado = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let detector: Detector | null = null;
    let trava: WakeLockSentinel | null = null;
    let proporcao = 1;
    let motor: Motor | null = null;
    const kpisPorFase = new Map<number, Kpis>();
    let ultimoTempoVideo = -1;
    let quadros = 0;
    let inicioJanela = 0;
    let fps = 30;
    let ultimoHud = 0;
    let ultimosKpis = 0;
    let chipsAoVivo: Indicador[] = [];
    let chipsDescanso: Indicador[] = [];
    let ultimoErro: string | null = null;
    let dicaDescanso: string | null = null;
    let segmentosRep: EstadoRep[] = [];
    let avisouFaltam10 = false;
    let avisouFaltam5 = false;
    /** Sem câmera: a fase por reps/escada/contra o relógio já declarou o valor ao fim do seu regressivo estimado. */
    let avisouFimManual = false;
    let perguntaSeq = 0;
    /** A série está acabando por "Pular" (não pelo tempo): sem câmera, não presume a meta. */
    let pulando = false;
    let feedback: { texto: string; ate: number } | null = null;
    let ultimoResultado: string | null = null;
    let encerrado = false;

    const falarSeAtivo = (texto: string, forcar = false) => {
      if (!vozDesligadaRef.current) falar(texto, forcar);
    };

    const avisar = (texto: string | undefined, agora: number) => {
      if (!texto) return;
      feedback = { texto, ate: agora + 1500 };
      falarSeAtivo(texto);
    };

    const nomeEx = (i: number) => blocos[i]?.exercicio ?? "";

    /** Começo de cada fase: som, voz e um motor novo nas fases de trabalho. */
    const iniciarFase = (f: Fase) => {
      motor = null;
      manualRepsRef.current = 0;
      if (f.tipo === "trabalho") {
        chipsAoVivo = [];
        segmentosRep = [];
        ultimoErro = null;
        avisouFaltam10 = false;
        avisouFaltam5 = false;
        avisouFimManual = false;
        som.largada();
        const def = defs[f.exercicio];
        if (comCamera && def) motor = new Motor(def, { proporcao, visibilidadeMinima: VISIBILIDADE_MINIMA });
        const meta = f.alvoReps ? `${f.alvoReps} repetições` : f.sustentar ? "segure a posição" : "o máximo que conseguir";
        falarSeAtivo(`${nomeEx(f.exercicio)}. ${meta}.`, true);
      } else if (f.tipo === "descanso") {
        chipsDescanso = chipsAoVivo;
        dicaDescanso = ultimoErro;
        som.parcial();
        falarSeAtivo(`Descanse. A seguir: ${nomeEx(f.proximo)}.`, true);
      } else if (f.tipo === "transicao") {
        // Troca de exercício sem pausa: a pergunta pendente era sobre o exercício anterior.
        setPerguntaManual(null);
        falarSeAtivo(`Próximo: ${nomeEx(f.exercicio)}.`, true);
      } else if (f.tipo === "preparo") {
        // Novo bloco (exercício diferente): a pergunta pendente da série anterior já não faz sentido.
        setPerguntaManual(null);
        som.parcial();
        const bl = linha.estrutura.blocos[f.exercicio];
        falarSeAtivo(`Prepare-se. ${nomeEx(f.exercicio)}. ${bl ? descreverBloco(bl, exercicios[f.exercicio]).replace(/ · /g, ", ") : ""}.`, true);
        registrarEvento("preparo_iniciado", { exercicio_id: blocos[f.exercicio]?.exercicioId });
      }
    };

    const tratarSessao = (eventos: EventoSessao[], agora: number) => {
      for (const e of eventos) {
        switch (e.tipo) {
          case "fase":
            iniciarFase(e.fase);
            break;
          case "contagem":
            som.tique();
            break;
          case "emom_cumprido":
            som.valida();
            falarSeAtivo("Minuto cumprido. Descanse até o próximo.", true);
            break;
          case "metade": {
            const f = sessao.fase;
            if (f.tipo === "trabalho" && f.sustentar && defs[f.exercicio]?.sustentacao?.lado) avisar("Troca de perna", agora);
            break;
          }
          case "resultado": {
            if (motor) kpisPorFase.set(e.resultado.fase, motor.kpis());
            const f = linha.fases[e.resultado.fase];
            const r = e.resultado;
            // Sem câmera não existe "repetição válida" (ninguém validou): o resumo da série
            // é a pergunta "Quantas você fez?" (ou nada, nas de sustentação).
            ultimoResultado = !comCamera
              ? null
              : f.tipo === "trabalho" && f.sustentar
                ? `${nomeEx(r.exercicio)}: ${Math.round(r.tempoValidoMs / 1000)} s na posição`
                : `${nomeEx(r.exercicio)}: ${r.reps} ${r.reps === 1 ? "repetição válida" : "repetições válidas"}`;
            // Sem câmera, ninguém contou: a série vale pelo que foi declarado — bipe de fim e,
            // fora das de sustentação, a pergunta opcional "Quantas você fez?" (seções 4 e 6).
            // Valor inicial: o que a pessoa tocou para contar ou, se não tocou, a meta da série
            // (mesma regra das séries por reps, que já declaram a meta ao fim do regressivo).
            if (!comCamera) {
              som.fim();
              if (f.tipo === "trabalho" && !f.sustentar) {
                const valor = r.reps > 0 || pulando ? r.reps : metaManual(f, exercicios[f.exercicio]);
                if (valor !== r.reps) sessao.corrigir(e.resultado.fase, valor);
                setPerguntaManual({ id: ++perguntaSeq, faseIndice: e.resultado.fase, exercicio: nomeEx(r.exercicio), reps: valor });
              }
            }
            break;
          }
          case "fim":
            terminar();
            break;
        }
      }
    };

    const terminar = () => {
      if (encerrado) return;
      encerrado = true;
      som.fim();
      calarVoz();
      const { resumo, porSerie, numeros } = resumir(linha, sessao.resultados);
      const enviados: BlocoEnviado[] = comCamera
        ? agregarPorExercicio(blocos.map((b) => b.ordem), sessao.resultados, kpisPorFase, numeros)
        : [];
      window.setTimeout(() => {
        if (!cancelado) entregar({ numeros: enviados, resumo, porSerie, resultados: [...sessao.resultados] });
      }, 600);
    };

    acaoRef.current = (qual) => {
      if (encerrado) return;
      if (qual === "pular") {
        // Série pulada: não presume a meta como feita.
        pulando = true;
        tratarSessao(sessao.pular(), performance.now());
        pulando = false;
      }
      else if (qual === "encerrar") tratarSessao(sessao.encerrar(), performance.now());
      else if (qual === "contarRep") {
        // Toque opcional para contar, sem câmera (seção 7 do pedido): cada toque é +1.
        const f = sessao.fase;
        if (f.tipo === "trabalho" && !f.sustentar) {
          manualRepsRef.current += 1;
          som.tique();
        }
      }
    };

    const quadro = () => {
      if (cancelado || encerrado) return;
      raf = requestAnimationFrame(quadro);
      const agora = performance.now();
      const f = sessao.fase;
      let pontos: Frame["pontos"] = null;
      let mundo: Frame["mundo"] = null;
      let corpoVisivel = !comCamera;
      let enquadramento: string | null = null;
      let erroAtivo = false;
      let segmentoErro: number[] = [];
      let reps = 0;
      let parciais = 0;
      let tempoValidoMs = 0;
      let fora = false;
      let naPosicao = false;

      if (comCamera) {
        if (!detector || !video || video.readyState < 2 || video.currentTime === ultimoTempoVideo) return;
        ultimoTempoVideo = video.currentTime;
        // Girar o celular (modo TV) troca o vídeo de 4:3 para 3:4: a proporção acompanha.
        if (video.videoHeight) proporcao = video.videoWidth / video.videoHeight;
        try {
          // A imagem é analisada aqui, no aparelho. Daqui só saem os pontos do corpo.
          const r = detector.landmarker.detectForVideo(video, agora);
          pontos = r.landmarks[0] ?? null;
          mundo = r.worldLandmarks[0] ?? null;
        } catch {
          return;
        }
        quadros++;
        if (agora - inicioJanela >= 2000) {
          fps = (quadros * 1000) / (agora - inicioJanela);
          quadros = 0;
          inicioJanela = agora;
        }
        const ex = f.tipo === "descanso" ? f.proximo : f.exercicio;
        const grupos = defs[ex] ? gruposObrigatorios(defs[ex]!.pontos_obrigatorios) : [];
        corpoVisivel = !!pontos && grupos.every((g) => g.some((i) => (pontos![i].visibility ?? 1) >= VISIBILIDADE_MINIMA));
        const defAtual = defs[ex];
        enquadramento = defAtual ? avaliarEnquadramento(pontos, defAtual, VISIBILIDADE_MINIMA, proporcao).aviso : null;
        if (motor && f.tipo === "trabalho" && !pausadoRef.current) {
          const eventos: EventoMotor[] = motor.processar({ t: agora, pontos, mundo });
          for (const e of eventos) {
            if (e.tipo === "rep_valida" || e.tipo === "alvo_acerto") {
              som.valida();
              segmentosRep.push("valida");
              registrarPrimeiraRepSeNecessario(blocos[f.exercicio]?.exercicioId ?? "");
            } else if (e.tipo === "rep_parcial") {
              som.parcial();
              segmentosRep.push("parcial");
              ultimoErro = e.feedback ?? ultimoErro;
              avisar(e.feedback, agora);
            } else if (e.tipo === "alvo_perdido") {
              som.parcial();
              segmentosRep.push("parcial");
            } else if (e.tipo === "erro") {
              ultimoErro = e.feedback;
              avisar(e.feedback, agora);
            } else if (e.tipo === "posicao_inicio") som.tique();
            else if (e.tipo === "posicao_perdida") {
              ultimoErro = e.feedback ?? ultimoErro;
              avisar(e.feedback, agora);
            } else if (e.tipo === "fora_quadro") falarSeAtivo("Não estou te vendo", true);
          }
          const estado = motor.estado;
          reps = estado.repsValidas;
          parciais = estado.repsParciais;
          tempoValidoMs = estado.tempoValidoMs;
          fora = estado.foraDoQuadro;
          naPosicao = estado.naPosicao;
          erroAtivo = estado.errosAtivos.length > 0;
          segmentoErro = estado.segmentoErro;
          if (agora - ultimosKpis >= 500 && defs[f.exercicio]) {
            ultimosKpis = agora;
            chipsAoVivo = indicadores(defs[f.exercicio]!, motor.kpis());
          }
        }
        if (ctx && canvas) {
          acompanharVideo(canvas, video);
          desenharEsqueleto(ctx, pontos, { valido: corpoVisivel, erro: erroAtivo, segmentoErro, visibilidadeMinima: VISIBILIDADE_MINIMA });
          const alvo = motor?.estado.alvo;
          if (alvo && f.tipo === "trabalho") desenharAlvo(ctx, alvo);
        }
      } else if (f.tipo === "trabalho") {
        // Sem câmera: reps só pelo toque opcional de contar; sustentação conta o tempo da fase.
        reps = manualRepsRef.current;
        tempoValidoMs = f.sustentar ? sessao.decorridoMs : 0;
        naPosicao = f.sustentar;
      }

      tratarSessao(sessao.tick(agora, { reps, parciais, tempoValidoMs, foraDoQuadro: fora, pausado: pausadoRef.current }), agora);

      // Sem câmera, reps/escada/contra o relógio não têm duracaoMs: um regressivo estimado
      // (duracaoManualMs) toma o lugar do tempo real, para a série avançar sozinha também
      // aí (seção 5) — ao fim dele, declara o que foi tocado (ou a meta) e segue.
      let faseAgora = sessao.fase;
      let restanteParaHud = sessao.restanteMs;
      let progressoParaHud = sessao.progresso;
      if (!comCamera && faseAgora.tipo === "trabalho" && !faseAgora.sustentar && faseAgora.duracaoMs === undefined) {
        const estimadoMs = duracaoManualMs(faseAgora, exercicios[faseAgora.exercicio]);
        const restanteEstimado = Math.max(0, estimadoMs - sessao.decorridoMs);
        restanteParaHud = restanteEstimado;
        progressoParaHud = estimadoMs > 0 ? Math.min(1, sessao.decorridoMs / estimadoMs) : 1;
        if (restanteEstimado <= 0 && !avisouFimManual && !pausadoRef.current) {
          avisouFimManual = true;
          const valorPadrao = Math.max(manualRepsRef.current, faseAgora.alvoReps ?? faseAgora.faixa?.min ?? 0);
          tratarSessao(sessao.declarar(valorPadrao), agora);
          faseAgora = sessao.fase;
          restanteParaHud = sessao.restanteMs;
          progressoParaHud = sessao.progresso;
        }
      }

      // "Faltam 10" e "faltam 5" falados: tempo real (AMRAP/isometria/Tabata/EMOM) ou,
      // sem câmera, o regressivo estimado acima (seção 9).
      if (faseAgora.tipo === "trabalho" && !pausadoRef.current && restanteParaHud !== null) {
        if (!avisouFaltam10 && restanteParaHud <= 10_000) {
          avisouFaltam10 = true;
          falarSeAtivo("Faltam 10 segundos");
        }
        if (!avisouFaltam5 && restanteParaHud <= 5_000) {
          avisouFaltam5 = true;
          falarSeAtivo("Faltam 5 segundos", true);
          som.tique();
        }
      }

      if (agora - ultimoHud >= 100) {
        ultimoHud = agora;
        setHud({
          carregando: false,
          indice: sessao.indice,
          restanteMs: restanteParaHud,
          restanteTetoMs: sessao.restanteTetoMs,
          progresso: progressoParaHud,
          reps,
          parciais,
          tempoValidoMs,
          naPosicao,
          emomCumprido: sessao.emomCumprido,
          feedback: feedback && agora < feedback.ate ? feedback.texto : null,
          fora,
          corpoVisivel,
          kpisDescanso: chipsDescanso,
          dicaCorrecao: dicaDescanso,
          segmentosRep: [...segmentosRep],
          ultimoResultado,
          lento: comCamera && fps < 12,
          enquadramento,
        });
      }
    };

    const iniciar = async () => {
      if (comCamera && video && canvas) {
        stream = await abrirCameraFrontal();
        registrarEvento("camera_permitida");
        if (cancelado) return fecharCamera(stream);
        video.srcObject = stream;
        await video.play();
        if (cancelado) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        proporcao = video.videoWidth / video.videoHeight;
        detector = await criarDetector("lite");
        if (cancelado) return detector.landmarker.close();
      }
      try {
        trava = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Sem Wake Lock: a tela pode apagar em desafios longos.
      }
      inicioJanela = performance.now();
      iniciarFase(sessao.fase);
      raf = requestAnimationFrame(quadro);
    };

    iniciar().catch((falha: Error) => {
      if (comCamera) registrarEvento("camera_negada", { motivo: falha.message });
      if (!cancelado) semCamera(falha.message || "Não consegui abrir a câmera.");
    });

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      fecharCamera(stream);
      if (video) video.srcObject = null;
      calarVoz();
      try {
        detector?.landmarker.close();
      } catch {
        // Já estava fechado.
      }
      void trava?.release().catch(() => {});
    };
  }, [blocos, exercicios, linha, comCamera]);

  useEffect(() => () => window.clearTimeout(timerOverlayRef.current), []);


  const ajustarDeclarado = (delta: number) => {
    setPerguntaManual((p) => {
      if (!p) return p;
      const novo = Math.max(0, p.reps + delta);
      sessaoRef.current?.corrigir(p.faseIndice, novo);
      return { ...p, reps: novo };
    });
  };

  const fase = linha.fases[hud.indice] ?? linha.fases[0];
  const emDescanso = fase.tipo === "descanso";

  // "Quantas você fez?" é opcional. Na pausa ela fica no painel, abaixo do tempo, até a pausa
  // acabar; fora da pausa (troca direta de série) desaparece sozinha em 6 s (reiniciado a cada ±).
  useEffect(() => {
    if (!perguntaManual || emDescanso) return;
    const t = window.setTimeout(() => setPerguntaManual(null), 6000);
    return () => window.clearTimeout(t);
  }, [perguntaManual, emDescanso]);
  const exIndice = fase.tipo === "descanso" ? fase.proximo : fase.exercicio;
  const bloco = blocos[exIndice] ?? blocos[0];
  const def = exercicioPorId(bloco.exercicioId);
  const sustentar = fase.tipo === "trabalho" && fase.sustentar;
  const ultimaFase = hud.indice >= linha.fases.length - 1;
  const totalTrabalhos = linha.fases.filter((f) => f.tipo === "trabalho").length;
  const trabalhoAtual = linha.fases.slice(0, hud.indice + 1).filter((f) => f.tipo === "trabalho").length;
  const respiracao = fase.tipo === "trabalho" && def?.formato === "respiracao";

  // Hive: publica a etapa, a série e o total de reps (só números) para os colegas.
  const publicarHive = hive?.publicar;
  useEffect(() => {
    if (!publicarHive || hud.carregando) return;
    const atual = linha.fases[hud.indice];
    if (!atual) return;
    if (atual.tipo === "trabalho") repsPorFaseRef.current.set(hud.indice, Math.max(hud.reps, repsPorFaseRef.current.get(hud.indice) ?? 0));
    let reps = 0;
    for (const r of repsPorFaseRef.current.values()) reps += r;
    publicarHive({
      etapa: atual.tipo === "trabalho" ? "serie" : atual.tipo === "descanso" ? "pausa" : "preparo",
      serie: trabalhoAtual,
      total: totalTrabalhos,
      reps,
    });
  }, [publicarHive, hud.carregando, hud.indice, hud.reps, linha, trabalhoAtual, totalTrabalhos]);

  const pausar = (qual: "dor" | "sair") => {
    pausadoRef.current = true;
    setOverlayAberto(false);
    setModal(qual);
  };
  const retomar = () => {
    pausadoRef.current = false;
    setModal(null);
  };
  const relatarDor = async (regiao: string) => {
    setEnviandoDor(true);
    await registrarDor(id, bloco.exercicioId, regiao);
    router.push("/trilha");
  };

  // --------------------------------------------------------------- overlay de toque
  const agendarFechamentoOverlay = () => {
    window.clearTimeout(timerOverlayRef.current);
    timerOverlayRef.current = window.setTimeout(() => setOverlayAberto(false), 4000);
  };
  const abrirOverlay = () => {
    if (modal || hud.carregando || fase.tipo !== "trabalho") return;
    setOverlayAberto(true);
    agendarFechamentoOverlay();
  };
  const fecharOverlay = () => {
    window.clearTimeout(timerOverlayRef.current);
    setOverlayAberto(false);
  };
  const alternarPausa = () => {
    pausadoRef.current = !pausadoRef.current;
    setPausadoUI(pausadoRef.current);
    if (pausadoRef.current) window.clearTimeout(timerOverlayRef.current);
    else agendarFechamentoOverlay();
  };
  const alternarVoz = () => {
    vozDesligadaRef.current = !vozDesligadaRef.current;
    setVozDesligada(vozDesligadaRef.current);
    if (vozDesligadaRef.current) calarVoz();
  };

  const popupAberto = fase.tipo === "preparo" && !hud.carregando;
  const cobertoPorPopup = popupAberto || modal !== null;
  const mostrarCameraCheia = comCamera && fase.tipo === "trabalho" && !hud.carregando;
  // Sem câmera, o HUD do trabalho (herói + barra) ocupa o painel preto no lugar do vídeo (seções 1, 2, 7 e 8 do pedido).
  const mostrarHudManual = !comCamera && fase.tipo === "trabalho" && !hud.carregando;
  const mostrarGabarito = fase.tipo !== "trabalho" || sustentar || !comCamera;
  const faseTrabalho: FaseTrabalho | null = fase.tipo === "trabalho" ? fase : null;
  const heroTipoBase: "reps" | "tempo" = faseTrabalho && faseTrabalho.duracaoMs === undefined ? "reps" : "tempo";
  // Sem câmera ninguém conta reps sozinho: o hero vira sempre um regressivo (real ou estimado).
  const heroTipo: "reps" | "tempo" = !comCamera && heroTipoBase === "reps" ? "tempo" : heroTipoBase;
  const mostrarHexagono = faseTrabalho !== null && heroTipo === "tempo" && !faseTrabalho.sustentar;
  const ultimosCincoSegundos = heroTipo === "tempo" && hud.restanteMs !== null && hud.restanteMs > 0 && hud.restanteMs <= 5000;
  const estiloMoldura = estiloProgresso === "moldura";
  const podeContarToque = mostrarHudManual && faseTrabalho !== null && !faseTrabalho.sustentar;

  return (
    <main
      ref={telaRef}
      className="fixed inset-0 z-10 mx-auto flex max-w-[430px] flex-col overflow-hidden bg-black text-white"
    >
      {/* Câmera em tela cheia (object-cover): fica montada o tempo todo, só escondida fora do trabalho. */}
      {comCamera && (
        <div className={`absolute inset-0 ${mostrarCameraCheia ? "" : "invisible"}`} onClick={mostrarCameraCheia ? abrirOverlay : undefined}>
          <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
          {respiracao && <Respiracao />}
        </div>
      )}

      {(mostrarCameraCheia || mostrarHudManual) && estiloMoldura && tela.w > 0 && (
        <Moldura
          w={tela.w}
          h={tela.h}
          tipo={heroTipo}
          progresso={hud.progresso}
          segmentos={hud.segmentosRep}
          meta={faseTrabalho?.alvoReps}
          urgente={ultimosCincoSegundos}
        />
      )}

      {!mostrarCameraCheia && <PainelFase fase={fase} hud={hud} bloco={bloco} proximoNome={fase.tipo === "descanso" ? fase.rotuloProximo : ""} comCamera={comCamera} onJaToPronto={() => acaoRef.current("pular")}
          pergunta={!modal ? perguntaManual : null} aoAjustarPergunta={ajustarDeclarado} aoFecharPergunta={() => setPerguntaManual(null)} />}

      {/* Topo: sair, exercício e posição no desafio, pular — pequeno, sobre o degradê. */}
      <header
        inert={cobertoPorPopup}
        aria-hidden={cobertoPorPopup || undefined}
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col ${mostrarCameraCheia ? "bg-gradient-to-b from-azul-noite/95 to-transparent pb-6" : ""}`}
      >
        <div className="pointer-events-auto flex items-center gap-2 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button onClick={() => pausar("sair")} aria-label="Encerrar o desafio" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/85 active:bg-white/10">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 text-center">
            {/* Topo = o que está acontecendo agora: na pausa, "Pausa" (o próximo exercício aparece no painel). */}
            <p className="fonte-rotulo truncate text-[15px] font-bold leading-tight">{fase.tipo === "descanso" ? "Pausa" : bloco.exercicio}</p>
            <p className="truncate text-xs text-white/70">
              {fase.tipo === "trabalho" ? fase.rotulo : fase.tipo === "descanso" ? "Respira. A próxima já vem." : "Prepare-se"}
              {hud.restanteTetoMs !== null ? ` · teto ${regressivo(hud.restanteTetoMs)}` : ""}
            </p>
          </div>
          <button onClick={() => acaoRef.current("pular")} disabled={hud.carregando} className="h-11 shrink-0 rounded-full bg-white/15 px-3.5 text-sm font-bold active:bg-white/25 disabled:opacity-40">
            {ultimaFase ? "Concluir" : "Pular ›"}
          </button>
        </div>
        <div className="pointer-events-auto">
          <FaixaHive descansando={fase.tipo === "descanso"} />
        </div>
        {hud.lento && <p className="pointer-events-none px-3 pt-1 text-center text-xs font-semibold text-atencao">A câmera está lenta neste aparelho; a contagem pode falhar.</p>}
      </header>

      <AvisosHive />

      {/* Referência pequena do gabarito (não é um painel de dado: fica discreta). */}
      {comCamera && mostrarGabarito && mostrarCameraCheia && (
        <div className="pointer-events-none absolute left-2 top-16 z-10 rounded-2xl bg-black/55 p-1.5 text-center text-white/80">
          <Gabarito exercicio={bloco.exercicioId} tamanho={sustentar ? 108 : 86} />
          <p className="text-[10px] font-bold uppercase tracking-wide">{sustentar ? "Posição esperada" : "Gabarito"}</p>
        </div>
      )}

      {/* HUD principal: hero + barra, hexágono secundário, avisos — tudo sobre o degradê de base. */}
      {(mostrarCameraCheia || mostrarHudManual) && faseTrabalho && (
        <div
          className={`${podeContarToque ? "pointer-events-auto" : "pointer-events-none"} absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 bg-gradient-to-t from-azul-noite/95 to-transparent px-5 pb-[max(3.5rem,calc(env(safe-area-inset-bottom)+3rem))] pt-16`}
          onClick={podeContarToque ? () => acaoRef.current("contarRep") : undefined}
        >
          {hud.fora || hud.enquadramento ? (
            <p className={`fonte-rotulo mx-auto rounded-xl bg-black/55 px-3 py-1.5 text-center text-sm font-bold leading-snug ${hud.fora ? "text-coral" : "text-atencao"}`}>
              {hud.enquadramento ?? "Não estou te vendo. Volte para o quadro."}
            </p>
          ) : null}

          {heroTipo === "reps" ? (
            <HeroReps
              valor={hud.reps}
              meta={faseTrabalho.alvoReps ?? 0}
              legenda={legendaHero(faseTrabalho, hud, !comCamera)}
              segmentos={estiloMoldura ? undefined : hud.segmentosRep}
              alinhamento={estiloMoldura ? "esquerda" : "centro"}
            />
          ) : (
            <HeroTempo
              texto={regressivo(hud.restanteMs ?? 0)}
              legenda={legendaHero(faseTrabalho, hud, !comCamera)}
              urgente={ultimosCincoSegundos}
              progresso={hud.progresso}
              mostrarBarra={!estiloMoldura}
              alinhamento={estiloMoldura ? "esquerda" : "centro"}
            />
          )}
          {podeContarToque && <p className="fonte-rotulo text-center text-[11px] font-semibold text-white/45">Toque para contar</p>}
        </div>
      )}

      {/* Sem câmera, o hexágono só aparece se a pessoa tocou para contar — senão voltaria a travar em "0". */}
      {mostrarHexagono && (mostrarCameraCheia || (mostrarHudManual && hud.reps > 0)) && (
        <Hexagono
          valor={hud.reps}
          meta={faseTrabalho?.alvoReps ?? faseTrabalho?.faixa?.max}
          rotulo={def?.formato === "precisao" ? "Acertos" : "Reps"}
          posicao={estiloMoldura ? "base-direita" : "topo-direita"}
        />
      )}

      {/* Aviso de correção: coral, centro da tela, 1,5 s (seção 6). Sem câmera, também avisa a troca de perna/lado. */}
      {(mostrarCameraCheia || mostrarHudManual) && hud.feedback && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-8">
          <p role="alert" className="fonte-rotulo max-w-xs rounded-2xl bg-coral px-6 py-3 text-center text-[28px] font-extrabold leading-tight text-[#0E1726]">
            {hud.feedback}
          </p>
        </div>
      )}

      {/* Sem câmera: pergunta opcional "Quantas você fez?" ao fim de uma série (seção 6). */}
      {perguntaManual && !modal && !emDescanso && (
        <QuantasVoceFez pergunta={perguntaManual} aoAjustar={ajustarDeclarado} aoFechar={() => setPerguntaManual(null)} flutuante />
      )}

      {/* "Senti dor": sempre visível, pequeno, embaixo. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[max(0.6rem,env(safe-area-inset-bottom))] z-20 flex justify-center">
        <button
          inert={cobertoPorPopup}
          aria-hidden={cobertoPorPopup || undefined}
          onClick={() => pausar("dor")}
          className="pointer-events-auto h-11 rounded-full border border-white/30 bg-black/35 px-4 text-sm font-bold text-white active:bg-white/15"
        >
          Senti dor
        </button>
      </div>

      {/* Overlay de toque: pausar, pular, dor, voz, sair. Fecha em 4 s ou com um toque fora. */}
      {overlayAberto && (
        <div role="dialog" aria-label="Opções do treino" className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-azul-noite/[0.78]" onClick={fecharOverlay}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              alternarPausa();
            }}
            aria-label={pausadoUI ? "Retomar" : "Pausar"}
            className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-esqueleto text-[#0E1726] active:scale-95"
          >
            {pausadoUI ? (
              <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </button>
          <p className="fonte-rotulo text-sm font-bold uppercase tracking-wide text-white/80">{pausadoUI ? "Pausado" : "Pausar"}</p>
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                fecharOverlay();
                acaoRef.current("pular");
              }}
              className="flex h-16 flex-col items-center justify-center rounded-2xl bg-white/15 px-4 text-xs font-bold text-white active:bg-white/25"
            >
              Pular<br />exercício
            </button>
            <button
              onClick={() => pausar("dor")}
              className="flex h-16 flex-col items-center justify-center rounded-2xl bg-white/15 px-4 text-xs font-bold text-white active:bg-white/25"
            >
              Senti<br />dor
            </button>
            <button
              onClick={alternarVoz}
              aria-pressed={!vozDesligada}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/15 text-xs font-bold text-white active:bg-white/25"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                {vozDesligada ? <path d="M3 10v4h4l5 5V5L7 10H3zm15.5 2a3.5 3.5 0 0 0-2-3.16v6.31a3.5 3.5 0 0 0 2-3.15zM19 4.5l1.5 1.5-3 3 .01.01A6 6 0 0 1 20 12a6 6 0 0 1-2 4.5l-1.42-1.42A4 4 0 0 0 18 12a4 4 0 0 0-1.1-2.76L4.5 21.5 3 20 19 4.5z" /> : <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23z" />}
              </svg>
              Voz
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              pausar("sair");
            }}
            className="mt-2 text-sm font-bold text-white/70 underline underline-offset-4"
          >
            Sair do treino
          </button>
        </div>
      )}

      {popupAberto && (
        <PopupPrepare
          nome={bloco.exercicio}
          exercicioId={bloco.exercicioId}
          bloco={linha.estrutura.blocos[exIndice]}
          exercicio={exercicios[exIndice]}
          segundos={Math.ceil((hud.restanteMs ?? 0) / 1000)}
          progresso={hud.progresso}
          primeiro={hud.indice === 0}
          duracaoMs={fase.tipo === "preparo" ? fase.duracaoMs : 0}
          enquadramento={comCamera ? { ok: hud.corpoVisivel && !hud.enquadramento, aviso: hud.enquadramento } : null}
          inerte={modal !== null}
          aoSair={() => pausar("sair")}
          aoComecar={() => acaoRef.current("pular")}
        />
      )}

      {modal === "dor" && (
        <div role="dialog" aria-modal="true" aria-label="Senti dor" className="absolute inset-0 z-50 flex items-end bg-black/75">
          <div className="w-full rounded-t-3xl bg-superficie p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-texto">
            <h2 className="text-2xl font-black">Onde está doendo?</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-apagado">
              O desafio está pausado. Se a dor for forte ou não passar, pare e procure um profissional de saúde.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {REGIOES.map(([valor, rotulo]) => (
                <button key={valor} disabled={enviandoDor} onClick={() => relatarDor(valor)} className="h-12 rounded-xl border border-borda bg-fundo text-base font-bold active:bg-superficie-2 disabled:opacity-50">
                  {rotulo}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-apagado">Ao escolher, o desafio é encerrado e o relato fica registrado só para você.</p>
            <button onClick={retomar} className="mt-4 h-14 w-full rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte">
              Foi só um susto, continuar
            </button>
          </div>
        </div>
      )}

      {modal === "sair" && (
        <div role="dialog" aria-modal="true" aria-label="Encerrar o desafio" className="absolute inset-0 z-50 flex items-end bg-black/75">
          <div className="w-full rounded-t-3xl bg-superficie p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-texto">
            <h2 className="text-2xl font-black">Encerrar o desafio?</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-apagado">O que você fez até aqui é registrado e vale XP.</p>
            <div className="mt-4 flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setModal(null);
                  pausadoRef.current = false;
                  acaoRef.current("encerrar");
                }}
                className="h-14 rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte"
              >
                Encerrar e registrar
              </button>
              <button onClick={retomar} className="h-14 rounded-2xl border border-borda text-lg font-bold active:bg-fundo">
                Continuar o desafio
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// =============================================================================== hero / barras

/** Número hero de repetições: 180px, amarelo, com "/meta" menor em branco e a barra segmentada embaixo. */
function HeroReps({
  valor, meta, legenda, segmentos, alinhamento,
}: {
  valor: number;
  meta: number;
  legenda: string | null;
  /** Indefinido quando a moldura já mostra a barra (estilo "moldura"). */
  segmentos?: EstadoRep[];
  alinhamento: "centro" | "esquerda";
}) {
  return (
    <div className={`flex flex-col ${alinhamento === "centro" ? "items-center text-center" : "items-start text-left"}`}>
      <p className="fonte-numero numero-camera text-esqueleto text-[clamp(4.5rem,34vw,180px)] leading-[0.85]">
        {valor}
        <span className="text-white/60" style={{ fontSize: "0.33em" }}>/{meta}</span>
      </p>
      <p className="fonte-rotulo mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/85">Repetições</p>
      {legenda && <p className="fonte-rotulo mt-0.5 text-sm font-semibold text-white/70">{legenda}</p>}
      {segmentos && <BarraSegmentada meta={meta} segmentos={segmentos} />}
    </div>
  );
}

/** Tempo hero regressivo: 130–150px, branco (coral nos últimos 5 s), com a barra contínua embaixo. */
function HeroTempo({
  texto, legenda, urgente, progresso, mostrarBarra, alinhamento,
}: {
  texto: string;
  legenda: string | null;
  urgente: boolean;
  progresso: number;
  mostrarBarra: boolean;
  alinhamento: "centro" | "esquerda";
}) {
  return (
    <div className={`flex flex-col ${alinhamento === "centro" ? "items-center text-center" : "items-start text-left"}`}>
      <p className={`fonte-numero numero-camera text-[clamp(3.5rem,27vw,150px)] leading-[0.85] ${urgente ? "text-coral" : "text-white"}`}>{texto}</p>
      <p className="fonte-rotulo mt-1 text-xs font-bold uppercase tracking-[0.18em] text-white/85">Restam</p>
      {legenda && <p className="fonte-rotulo mt-0.5 text-sm font-semibold text-white/70">{legenda}</p>}
      {mostrarBarra && <BarraContinua progresso={progresso} urgente={urgente} />}
    </div>
  );
}

function BarraSegmentada({ meta, segmentos }: { meta: number; segmentos: EstadoRep[] }) {
  if (meta <= 0) return null;
  return (
    <div className="mt-2 flex w-full max-w-[230px] gap-1">
      {Array.from({ length: meta }, (_, i) => {
        const s = segmentos[i];
        return (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full ${s === "valida" ? "bg-esqueleto" : s === "parcial" ? "bg-coral" : "bg-white/20"}`}
          />
        );
      })}
    </div>
  );
}

function BarraContinua({ progresso, urgente }: { progresso: number; urgente: boolean }) {
  return (
    <div className="mt-2 h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-white/20">
      <div
        className={`h-full rounded-full transition-[width] duration-150 ${urgente ? "bg-coral" : "bg-white"}`}
        style={{ width: `${Math.round(progresso * 100)}%` }}
      />
    </div>
  );
}

/**
 * Sem câmera: pergunta opcional de 1 toque ao fim de uma série (seção 6 do
 * pedido). A série já avançou sozinha — isto só corrige o valor declarado
 * (± em torno da meta); some sozinha depois de alguns segundos.
 */
function QuantasVoceFez({
  pergunta, aoAjustar, aoFechar, flutuante = false,
}: {
  pergunta: PerguntaManual;
  aoAjustar: (delta: number) => void;
  aoFechar: () => void;
  /** Fora da pausa: cartão sobre o topo da tela. Na pausa: dentro do painel, abaixo do tempo. */
  flutuante?: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-label="Quantas você fez?"
      className={`${flutuante ? "absolute inset-x-4 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-[60] shadow-lg" : "w-full max-w-xs"} rounded-2xl bg-superficie p-4 text-left text-texto`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="fonte-rotulo text-xs font-bold uppercase tracking-wide text-apagado">Quantas você fez?</p>
          <p className="truncate text-sm font-semibold">{pergunta.exercicio}</p>
        </div>
        <button onClick={aoFechar} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-apagado active:bg-fundo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4">
        <button onClick={() => aoAjustar(-1)} aria-label="Menos uma" className="flex h-11 w-11 items-center justify-center rounded-full border border-borda text-xl font-black active:bg-fundo">−</button>
        <p className="fonte-numero numero-camera w-16 text-center text-3xl">{pergunta.reps}</p>
        <button onClick={() => aoAjustar(1)} aria-label="Mais uma" className="flex h-11 w-11 items-center justify-center rounded-full border border-borda text-xl font-black active:bg-fundo">+</button>
      </div>
    </div>
  );
}

/** Reps secundárias: hexágono amarelo (pointy-top) com o número em azul-noite. */
function Hexagono({
  valor, meta, rotulo, posicao,
}: {
  valor: number;
  meta?: number;
  rotulo: string;
  posicao: "topo-direita" | "base-direita";
}) {
  return (
    <div
      className={`pointer-events-none absolute z-20 flex h-[88px] w-[78px] flex-col items-center justify-center bg-esqueleto text-[#0E1726] ${
        posicao === "topo-direita" ? "right-3 top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))]" : "bottom-[max(3.75rem,calc(env(safe-area-inset-bottom)+3.25rem))] right-4"
      }`}
      style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
    >
      <p className="fonte-numero numero-camera text-2xl leading-none">
        {valor}
        {meta !== undefined && <span className="text-xs opacity-70">/{meta}</span>}
      </p>
      <p className="fonte-rotulo mt-0.5 text-[9px] font-bold uppercase tracking-wide">{rotulo}</p>
    </div>
  );
}

/** Estilo "moldura": a borda da tela vira a barra de progresso (rx 46, traço 10px). */
function Moldura({
  w, h, tipo, progresso, segmentos, meta, urgente,
}: {
  w: number;
  h: number;
  tipo: "reps" | "tempo";
  progresso: number;
  segmentos: EstadoRep[];
  meta?: number;
  urgente: boolean;
}) {
  const margem = 5;
  const raio = 46;
  const espessura = 10;
  const largura = Math.max(0, w - margem * 2);
  const altura = Math.max(0, h - margem * 2);
  const retoH = Math.max(0, largura - 2 * raio);
  const retoV = Math.max(0, altura - 2 * raio);
  const perimetro = 2 * retoH + 2 * retoV + 2 * Math.PI * raio;

  return (
    <svg className="pointer-events-none absolute inset-0 z-10" width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <rect x={margem} y={margem} width={largura} height={altura} rx={raio} ry={raio} stroke="rgba(255,255,255,0.18)" strokeWidth={espessura} />
      {tipo === "tempo" ? (
        <rect
          x={margem} y={margem} width={largura} height={altura} rx={raio} ry={raio}
          stroke={urgente ? "#FF5A4E" : "#FFFFFF"} strokeWidth={espessura} strokeLinecap="round"
          strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - progresso)}
          style={{ transition: "stroke-dashoffset 150ms linear" }}
        />
      ) : (
        meta &&
        meta > 0 &&
        Array.from({ length: meta }, (_, i) => {
          const gap = Math.min(10, (perimetro / meta) * 0.22);
          const segLen = Math.max(1, perimetro / meta - gap);
          const offset = perimetro - i * (segLen + gap);
          const estado = segmentos[i];
          const cor = estado === "valida" ? "#FFB81C" : estado === "parcial" ? "#FF5A4E" : "rgba(255,255,255,0.18)";
          return (
            <rect
              key={i} x={margem} y={margem} width={largura} height={altura} rx={raio} ry={raio}
              stroke={cor} strokeWidth={espessura}
              strokeDasharray={`${segLen} ${Math.max(0, perimetro - segLen)}`} strokeDashoffset={offset}
            />
          );
        })
      )}
    </svg>
  );
}

// =============================================================================== painel fora do trabalho

/**
 * Painel de tela cheia (azul-noite) usado quando a câmera não é o foco:
 * transição, descanso (com os KPIs escondidos durante a série — seção 5 e 8) e
 * todo o modo sem câmera.
 */
function PainelFase({
  fase, hud, bloco, proximoNome, comCamera, onJaToPronto, pergunta, aoAjustarPergunta, aoFecharPergunta,
}: {
  fase: Fase;
  hud: Hud;
  bloco: BlocoDesafio;
  proximoNome: string;
  comCamera: boolean;
  onJaToPronto: () => void;
  /** Sem câmera: "Quantas você fez?" da série que acabou, mostrada abaixo do tempo da pausa. */
  pergunta: PerguntaManual | null;
  aoAjustarPergunta: (delta: number) => void;
  aoFecharPergunta: () => void;
}) {
  if (hud.carregando) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-azul-noite px-6 text-center">
        <p className="fonte-rotulo text-2xl font-black">{comCamera ? "Abrindo a câmera…" : "Preparando…"}</p>
      </div>
    );
  }

  if (fase.tipo === "transicao") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-azul-noite px-6 text-center">
        <p className="fonte-numero numero-camera text-[clamp(5rem,26vw,8rem)] leading-none">{Math.ceil((hud.restanteMs ?? 0) / 1000)}</p>
        <p className="fonte-rotulo text-lg font-bold text-white/80">Próximo: {bloco.exercicio}</p>
      </div>
    );
  }

  if (fase.tipo === "descanso") {
    return (
      <div className="flex h-full flex-col items-center gap-4 overflow-y-auto bg-azul-noite px-6 pb-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] pt-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] text-center">
        <div>
          <p className="fonte-numero numero-camera text-[clamp(4.5rem,24vw,7rem)] leading-none">{regressivo(hud.restanteMs ?? 0)}</p>
          <div className="mt-2 h-2 w-56 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-[width] duration-150" style={{ width: `${Math.round(hud.progresso * 100)}%` }} />
          </div>
        </div>

        {hud.kpisDescanso.length > 0 && (
          <dl className="grid w-full max-w-xs grid-cols-3 gap-2">
            {hud.kpisDescanso.map((i) => (
              <div key={i.rotulo} className="rounded-xl bg-white/10 px-2 py-2">
                <dd className={`fonte-numero text-lg leading-none ${i.bom ? "text-bom" : "text-atencao"}`}>{i.valor}</dd>
                <dt className="fonte-rotulo mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">{i.rotulo}</dt>
              </div>
            ))}
          </dl>
        )}

        {pergunta && <QuantasVoceFez pergunta={pergunta} aoAjustar={aoAjustarPergunta} aoFechar={aoFecharPergunta} />}
        {hud.ultimoResultado && <p className="fonte-rotulo text-[15px] font-semibold text-white/80">{hud.ultimoResultado}</p>}
        {hud.dicaCorrecao && (
          <p className="fonte-rotulo max-w-xs rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-atencao">Dica: {hud.dicaCorrecao}</p>
        )}

        <div className="mt-auto flex w-full max-w-xs flex-col items-center gap-3">
          <p className="fonte-rotulo text-sm font-bold uppercase tracking-wide text-white/60">Próximo</p>
          <p className="fonte-rotulo text-xl font-black">{proximoNome}</p>
          <button onClick={onJaToPronto} className="h-14 w-full rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte">
            Já tô pronto
          </button>
        </div>
      </div>
    );
  }

  // Modo sem câmera (ou "preparo", mascarado pelo pop-up PREPARE-SE por cima): Gabarito e dica
  // ocupam o topo; o HUD (herói + barra, seções 1, 2, 7 e 8) é desenhado por fora, na base.
  if (!comCamera) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto bg-azul-noite px-6 pb-[max(14rem,calc(env(safe-area-inset-bottom)+13rem))] pt-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] text-center">
        {/* O boneco é a referência de quem treina sem câmera: grande, no meio do espaço livre. */}
        <Gabarito exercicio={bloco.exercicioId} tamanho={fase.tipo === "trabalho" && fase.sustentar ? 240 : 220} />
        <p className="text-[15px] leading-relaxed text-white/75">{dicaDoGabarito(bloco.exercicioId)}</p>
      </div>
    );
  }

  return <div className="h-full bg-black" />;
}

/**
 * Pop-up "PREPARE-SE": aparece antes do primeiro esforço de cada exercício,
 * com as instruções rápidas e a contagem regressiva. "Ok, let's hive" pula a
 * contagem e começa na hora.
 */
function PopupPrepare({
  nome, exercicioId, bloco, exercicio, segundos, progresso, primeiro, duracaoMs, enquadramento, inerte, aoSair, aoComecar,
}: {
  nome: string;
  exercicioId: string;
  bloco: Bloco | undefined;
  exercicio: ExercicioMetodo | undefined;
  segundos: number;
  progresso: number;
  primeiro: boolean;
  /** Duração do pop-up: acima de 15 s ele também é a pausa entre exercícios. */
  duracaoMs: number;
  /** Situação da câmera (null no modo sem câmera). */
  enquadramento: { ok: boolean; aviso: string | null } | null;
  inerte: boolean;
  aoSair: () => void;
  aoComecar: () => void;
}) {
  const pausaLonga = duracaoMs > 15_000;
  return (
    <div inert={inerte} aria-hidden={inerte || undefined} role="dialog" aria-modal="true" aria-label={`Prepare-se: ${nome}`} className="absolute inset-0 z-50 flex flex-col bg-[#F5F2EA] text-black">
      <div className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button onClick={aoSair} aria-label="Encerrar o desafio" className="flex h-12 w-12 items-center justify-center rounded-full text-black/60 active:bg-black/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="pr-4 text-sm font-black uppercase tracking-[0.18em] text-black/60">{pausaLonga ? "Pausa · Prepare-se" : "Prepare-se"}</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-5 pb-3 text-center">
        <h2 className="text-[1.75rem] font-black leading-tight">{nome}</h2>
        {bloco && <p className="mt-1 text-lg font-bold leading-snug">{descreverBloco(bloco, exercicio)}</p>}
        {bloco && <p className="text-base font-semibold text-black/70">{descreverScore(bloco)}</p>}
        <div className="my-2 rounded-3xl bg-[#17191e] p-2">
          <Gabarito exercicio={exercicioId} tamanho={150} />
        </div>
        {bloco && (
          <ul className="flex flex-wrap justify-center gap-1.5">
            {etiquetasDoBloco(bloco).map((e) => (
              <li key={e.rotulo} className="rounded-full border border-black/20 bg-white px-2.5 py-0.5 text-sm font-bold">
                <span className="text-black/55">{e.rotulo}</span> {e.valor}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[15px] leading-snug text-black/75">
          {bloco?.cadencia ? `Cadência: ${explicarCadencia(bloco.cadencia)}. ` : ""}
          {dicaDoGabarito(exercicioId)}
        </p>
        {primeiro && !enquadramento && <p className="mt-1 text-[15px] font-semibold text-black/75">Afaste-se até o corpo inteiro aparecer na câmera.</p>}
      </div>
      <div className="flex flex-col items-center gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {enquadramento && (
          <p
            role="status"
            className={`w-full rounded-xl px-3 py-2 text-center text-[15px] font-bold leading-snug ${enquadramento.ok ? "bg-[#1f7a46] text-white" : "bg-[#f3c34a] text-black"}`}
          >
            {enquadramento.ok ? "✓ Câmera te vendo bem" : (enquadramento.aviso ?? "Afaste-se até o corpo aparecer na câmera.")}
          </p>
        )}
        {pausaLonga && <p className="-mb-2 text-base font-bold text-black/60">Descanse. Começa em</p>}
        <p role="timer" aria-label={`Começa em ${segundos} segundos`} className="text-[clamp(5rem,26vw,7rem)] font-black leading-none tabular-nums">
          {segundos}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/10" aria-hidden>
          <div className="h-full bg-black/60 transition-[width] duration-150" style={{ width: `${Math.round(progresso * 100)}%` }} />
        </div>
        <button onClick={aoComecar} className="h-14 w-full rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte">
          Ok, let&apos;s hive
        </button>
      </div>
    </div>
  );
}

/** Guia da respiração: o círculo cresce em 4 s (inspira) e diminui em 6 s (expira). */
function Respiracao() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const inicio = performance.now();
    let raf = 0;
    const passo = () => {
      setT(((performance.now() - inicio) / 1000) % 10);
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, []);
  const inspira = t < 4;
  const escala = inspira ? 0.55 + 0.45 * (t / 4) : 1 - 0.45 * ((t - 4) / 6);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <div className="h-44 w-44 rounded-full border-4 border-mel bg-mel/20" style={{ transform: `scale(${escala})` }} />
      <p className="numero-camera mt-3 text-3xl font-black">{inspira ? "Inspire" : "Solte o ar"}</p>
    </div>
  );
}

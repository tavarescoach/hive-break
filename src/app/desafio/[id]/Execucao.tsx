"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { abrirCameraFrontal, fecharCamera } from "@/camera/camera";
import { desenharAlvo, desenharEsqueleto } from "@/camera/desenhar-esqueleto";
import { criarDetector, type Detector } from "@/camera/pose";
import { som } from "@/camera/som";
import { calarVoz, falar } from "@/camera/voz";
import { Gabarito, dicaDoGabarito } from "@/componentes/Gabarito";
import { agregarPorExercicio, type BlocoEnviado } from "@/dominio/agregar";
import {
  descreverBloco, descreverScore, etiquetasDoBloco, explicarCadencia, formatarTempo, resumir, SessaoTreino,
  type Bloco, type EventoSessao, type ExercicioMetodo, type Fase, type LinhaDoTempo,
} from "@/dominio/metodos";
import { ehSustentacao, exercicioPorId } from "@/exercicios";
import { Motor } from "@/motor/motor";
import { gruposObrigatorios } from "@/motor/pontos";
import type { DefinicaoExercicio, EventoMotor, Frame, Kpis } from "@/motor/tipos";
import { registrarDor } from "./acoes";
import type { BlocoDesafio, FimDoDesafio } from "./Desafio";

const VISIBILIDADE_MINIMA = 0.6;
const REGIOES = [
  ["joelho", "Joelho"], ["ombro", "Ombro"], ["lombar", "Lombar"], ["punho", "Punho"],
  ["quadril", "Quadril"], ["tornozelo", "Tornozelo"], ["pescoco", "Pescoço"], ["outra", "Outro lugar"],
] as const;

/** Cores das fases: trabalho em amarelo-mel, descanso em cinza, preparo e transição em branco. */
const COR_FASE: Record<Fase["tipo"], string> = {
  trabalho: "bg-mel text-black",
  descanso: "bg-[#3A3E48] text-white",
  preparo: "bg-[#F5F2EA] text-black",
  transicao: "bg-[#F5F2EA] text-black",
};

interface Indicador {
  rotulo: string;
  valor: string;
  bom: boolean;
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
  feedback: string | null;
  fora: boolean;
  corpoVisivel: boolean;
  indicadores: Indicador[];
  ultimoResultado: string | null;
  lento: boolean;
}

const HUD_INICIAL: Hud = {
  carregando: true, indice: 0, restanteMs: null, restanteTetoMs: null, progresso: 0, reps: 0, parciais: 0,
  tempoValidoMs: 0, naPosicao: false, emomCumprido: false, feedback: null, fora: false, corpoVisivel: false,
  indicadores: [], ultimoResultado: null, lento: false,
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** Tempo em m:ss, arredondando para cima (contagem regressiva). */
const regressivo = (ms: number) => formatarTempo(Math.ceil(ms / 1000));

/** Dois ou três KPIs ao vivo, conforme o tipo de exercício (seção 8.5). */
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

interface Props {
  id: string;
  blocos: BlocoDesafio[];
  exercicios: ExercicioMetodo[];
  linha: LinhaDoTempo;
  comCamera: boolean;
  /** Fim do desafio: números por bloco (vazio no modo sem câmera), resumo geral e por série. */
  aoFim: (fim: FimDoDesafio) => void;
  /** A câmera não abriu: a tela troca para o modo sem câmera. */
  aoSemCamera: (mensagem: string) => void;
}

/**
 * Execução do desafio: percorre as fases do método (preparo, trabalho,
 * descanso, transição) com a câmera contando, ou com o timer e o botão "Feito"
 * no modo sem câmera. O vídeo é analisado no aparelho.
 */
export function Execucao({ id, blocos, exercicios, linha, comCamera, aoFim, aoSemCamera }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessaoRef = useRef<SessaoTreino>(null);
  const pausadoRef = useRef(false);
  const manualRepsRef = useRef(0);
  const acaoRef = useRef<(qual: "pular" | "encerrar" | "feito") => void>(() => {});
  const [hud, setHud] = useState<Hud>(HUD_INICIAL);
  const [modal, setModal] = useState<"dor" | "sair" | null>(null);
  const [enviandoDor, setEnviandoDor] = useState(false);
  const entregar = useEffectEvent(aoFim);
  const semCamera = useEffectEvent(aoSemCamera);

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
    let chips: Indicador[] = [];
    let feedback: { texto: string; ate: number } | null = null;
    let ultimoResultado: string | null = null;
    let encerrado = false;

    const avisar = (texto: string | undefined, agora: number) => {
      if (!texto) return;
      feedback = { texto, ate: agora + 2500 };
      falar(texto);
    };

    const nomeEx = (i: number) => blocos[i]?.exercicio ?? "";

    /** Começo de cada fase: som, voz e um motor novo nas fases de trabalho. */
    const iniciarFase = (f: Fase) => {
      motor = null;
      chips = [];
      manualRepsRef.current = 0;
      if (f.tipo === "trabalho") {
        som.largada();
        const def = defs[f.exercicio];
        if (comCamera && def) motor = new Motor(def, { proporcao, visibilidadeMinima: VISIBILIDADE_MINIMA });
        const meta = f.alvoReps ? `${f.alvoReps} repetições` : f.sustentar ? "segure a posição" : "o máximo que conseguir";
        falar(`${nomeEx(f.exercicio)}. ${meta}.`, true);
      } else if (f.tipo === "descanso") {
        som.parcial();
        falar(`Descanse. A seguir: ${nomeEx(f.proximo)}.`, true);
      } else if (f.tipo === "transicao") {
        falar(`Próximo: ${nomeEx(f.exercicio)}.`, true);
      } else if (f.tipo === "preparo") {
        som.parcial();
        const bl = linha.estrutura.blocos[f.exercicio];
        falar(`Prepare-se. ${nomeEx(f.exercicio)}. ${bl ? descreverBloco(bl, exercicios[f.exercicio]).replace(/ · /g, ", ") : ""}.`, true);
      }
    };

    const tratarSessao = (eventos: EventoSessao[]) => {
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
            falar("Minuto cumprido. Descanse até o próximo.", true);
            break;
          case "resultado": {
            if (motor) kpisPorFase.set(e.resultado.fase, motor.kpis());
            const f = linha.fases[e.resultado.fase];
            const r = e.resultado;
            ultimoResultado =
              f.tipo === "trabalho" && f.sustentar
                ? `${nomeEx(r.exercicio)}: ${Math.round(r.tempoValidoMs / 1000)} s na posição`
                : `${nomeEx(r.exercicio)}: ${r.reps} ${r.reps === 1 ? "repetição válida" : "repetições válidas"}`;
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
        if (!cancelado) entregar({ numeros: enviados, resumo, porSerie });
      }, 600);
    };

    acaoRef.current = (qual) => {
      if (encerrado) return;
      if (qual === "pular") tratarSessao(sessao.pular());
      else if (qual === "encerrar") tratarSessao(sessao.encerrar());
      else if (qual === "feito") {
        const f = sessao.fase;
        if (f.tipo === "trabalho") manualRepsRef.current = f.alvoReps ?? manualRepsRef.current + 1;
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
      let erroAtivo = false;
      let reps = 0;
      let parciais = 0;
      let tempoValidoMs = 0;
      let fora = false;
      let naPosicao = false;

      if (comCamera) {
        if (!detector || !video || video.readyState < 2 || video.currentTime === ultimoTempoVideo) return;
        ultimoTempoVideo = video.currentTime;
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
        if (motor && f.tipo === "trabalho" && !pausadoRef.current) {
          const eventos: EventoMotor[] = motor.processar({ t: agora, pontos, mundo });
          for (const e of eventos) {
            if (e.tipo === "rep_valida" || e.tipo === "alvo_acerto") som.valida();
            else if (e.tipo === "rep_parcial") {
              som.parcial();
              avisar(e.feedback, agora);
            } else if (e.tipo === "alvo_perdido") som.parcial();
            else if (e.tipo === "erro") avisar(e.feedback, agora);
            else if (e.tipo === "posicao_inicio") som.tique();
            else if (e.tipo === "posicao_perdida") avisar(e.feedback, agora);
            else if (e.tipo === "fora_quadro") falar("Não estou te vendo", true);
          }
          const estado = motor.estado;
          reps = estado.repsValidas;
          parciais = estado.repsParciais;
          tempoValidoMs = estado.tempoValidoMs;
          fora = estado.foraDoQuadro;
          naPosicao = estado.naPosicao;
          erroAtivo = estado.errosAtivos.length > 0;
          if (agora - ultimosKpis >= 500 && defs[f.exercicio]) {
            ultimosKpis = agora;
            chips = indicadores(defs[f.exercicio]!, motor.kpis());
          }
        }
        if (ctx) {
          desenharEsqueleto(ctx, pontos, { valido: corpoVisivel, erro: erroAtivo, visibilidadeMinima: VISIBILIDADE_MINIMA });
          const alvo = motor?.estado.alvo;
          if (alvo && f.tipo === "trabalho") desenharAlvo(ctx, alvo);
        }
      } else if (f.tipo === "trabalho") {
        // Sem câmera: reps pelo botão "Feito"; sustentação conta o tempo da fase.
        reps = manualRepsRef.current;
        tempoValidoMs = f.sustentar ? sessao.decorridoMs : 0;
        naPosicao = f.sustentar;
      }

      tratarSessao(sessao.tick(agora, { reps, parciais, tempoValidoMs, foraDoQuadro: fora, pausado: pausadoRef.current }));

      if (agora - ultimoHud >= 100) {
        ultimoHud = agora;
        setHud({
          carregando: false,
          indice: sessao.indice,
          restanteMs: sessao.restanteMs,
          restanteTetoMs: sessao.restanteTetoMs,
          progresso: sessao.progresso,
          reps,
          parciais,
          tempoValidoMs,
          naPosicao,
          emomCumprido: sessao.emomCumprido,
          feedback: feedback && agora < feedback.ate ? feedback.texto : null,
          fora,
          corpoVisivel,
          indicadores: chips,
          ultimoResultado,
          lento: comCamera && fps < 12,
        });
      }
    };

    const iniciar = async () => {
      if (comCamera && video && canvas) {
        stream = await abrirCameraFrontal();
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

  const fase = linha.fases[hud.indice] ?? linha.fases[0];
  const exIndice = fase.tipo === "descanso" ? fase.proximo : fase.exercicio;
  const bloco = blocos[exIndice] ?? blocos[0];
  const def = exercicioPorId(bloco.exercicioId);
  const sustentar = fase.tipo === "trabalho" && fase.sustentar;
  const ultimaFase = hud.indice >= linha.fases.length - 1;
  const totalTrabalhos = linha.fases.filter((f) => f.tipo === "trabalho").length;
  const trabalhoAtual = linha.fases.slice(0, hud.indice + 1).filter((f) => f.tipo === "trabalho").length;
  const respiracao = fase.tipo === "trabalho" && def?.formato === "respiracao";

  const pausar = (qual: "dor" | "sair") => {
    pausadoRef.current = true;
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

  // ------------------------------------------------------------- painel da fase
  let principal: React.ReactNode = null;
  let secundario: string | null = null;
  const grande = "font-black leading-[0.9] tabular-nums";
  const rotuloNumero = "mb-1 text-sm font-black uppercase tracking-[0.14em] opacity-70";
  if (hud.carregando) {
    principal = <p className="text-3xl font-black">{comCamera ? "Abrindo a câmera…" : "Preparando…"}</p>;
  } else if (fase.tipo === "preparo") {
    principal = <p className={`${grande} text-[clamp(7rem,40vw,12rem)]`}>{Math.ceil((hud.restanteMs ?? 0) / 1000)}</p>;
    secundario = "Prepare-se";
  } else if (fase.tipo === "descanso") {
    principal = <p className={`${grande} text-[clamp(7rem,36vw,11rem)]`}>{regressivo(hud.restanteMs ?? 0)}</p>;
    secundario = `Descanso · a seguir: ${fase.rotuloProximo}`;
  } else if (fase.tipo === "transicao") {
    principal = <p className={`${grande} text-[clamp(6rem,30vw,9rem)]`}>{Math.ceil((hud.restanteMs ?? 0) / 1000)}</p>;
    secundario = `Próximo: ${bloco.exercicio}`;
  } else if (sustentar) {
    principal = <p className={`${grande} text-[clamp(6.5rem,32vw,10rem)]`}>{regressivo(hud.restanteMs ?? 0)}</p>;
    secundario = hud.naPosicao ? `Na posição: ${Math.floor(hud.tempoValidoMs / 1000)} s` : "Entre na posição do gabarito";
  } else if (fase.emom && hud.emomCumprido) {
    principal = <p className={`${grande} text-[clamp(6.5rem,32vw,10rem)]`}>{regressivo(hud.restanteMs ?? 0)}</p>;
    secundario = "Minuto cumprido · descanse até o próximo";
  } else if (fase.alvoReps !== undefined) {
    const tempo = fase.duracaoMs !== undefined ? regressivo(hud.restanteMs ?? 0) : null;
    principal = (
      <div className="flex items-end justify-center gap-4">
        <p className={`${grande} text-[clamp(6rem,30vw,9.5rem)]`}>
          {hud.reps}
          <span className="text-[0.5em] opacity-60">/{fase.alvoReps}</span>
        </p>
        {tempo && <p className={`${grande} pb-2 text-[clamp(2.5rem,12vw,4rem)] opacity-80`}>{tempo}</p>}
      </div>
    );
    secundario = hud.parciais > 0 ? `${hud.parciais} ${hud.parciais === 1 ? "parcial" : "parciais"} (não contam)` : "repetições";
  } else {
    // Por tempo (AMRAP ou faixa): tempo e reps lado a lado, os dois grandes.
    principal = (
      <div className="grid w-full grid-cols-2 items-end">
        <div>
          <p className={rotuloNumero}>Tempo</p>
          <p className={`${grande} text-[clamp(4.5rem,22vw,7rem)]`}>{regressivo(hud.restanteMs ?? 0)}</p>
        </div>
        <div>
          <p className={rotuloNumero}>{def?.formato === "precisao" ? "Acertos" : "Reps"}</p>
          <p className={`${grande} text-[clamp(4.5rem,22vw,7rem)]`}>{hud.reps}</p>
        </div>
      </div>
    );
    secundario = fase.faixa ? `Meta: ${fase.faixa.min} a ${fase.faixa.max} repetições` : "O máximo que conseguir, com boa técnica";
  }
  const corPainel = fase.tipo === "trabalho" && fase.emom && hud.emomCumprido ? COR_FASE.descanso : COR_FASE[fase.tipo];
  const descansando = fase.tipo === "descanso";
  const popupAberto = fase.tipo === "preparo" && !hud.carregando;
  const cobertoPorPopup = popupAberto || modal !== null;
  const mostrarGabarito = fase.tipo !== "trabalho" || sustentar || !comCamera;

  return (
    <main className="fixed inset-0 z-10 mx-auto flex max-w-[430px] flex-col overflow-hidden bg-black text-white">
      {/* Topo: sair, exercício e posição no desafio, pular */}
      <header inert={cobertoPorPopup} aria-hidden={cobertoPorPopup || undefined} className="flex items-center gap-2 bg-black px-2 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button onClick={() => pausar("sair")} aria-label="Encerrar o desafio" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white/80 active:bg-white/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-lg font-black leading-tight">{bloco.exercicio}</p>
          <p className="truncate text-sm text-white/70">
            {fase.tipo === "trabalho" ? fase.rotulo : `Etapa ${Math.min(trabalhoAtual + 1, totalTrabalhos)} de ${totalTrabalhos}`}
            {hud.restanteTetoMs !== null ? ` · teto ${regressivo(hud.restanteTetoMs)}` : ""}
          </p>
        </div>
        <button onClick={() => acaoRef.current("pular")} disabled={hud.carregando} className="h-12 shrink-0 rounded-full bg-white/15 px-4 text-base font-bold active:bg-white/25 disabled:opacity-40">
          {ultimaFase ? "Concluir" : "Pular ›"}
        </button>
      </header>

      {/* Painel da fase: cor, número principal enorme e barra de progresso */}
      <section
        inert={cobertoPorPopup} aria-hidden={cobertoPorPopup || undefined}
        aria-live="polite"
        className={`relative flex shrink-0 flex-col items-center justify-center px-4 py-3 text-center transition-[flex-grow] duration-300 ${corPainel} ${descansando ? "grow" : ""}`}
        style={{ minHeight: descansando ? undefined : "36%" }}
      >
        <div role="timer" className="flex w-full flex-col items-center">{principal}</div>
        {secundario && <p className="mt-2 text-lg font-bold leading-tight opacity-85">{secundario}</p>}
        {descansando && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <Gabarito exercicio={bloco.exercicioId} tamanho={150} cor="#FFC42E" />
            {hud.ultimoResultado && <p className="text-base font-semibold text-white/80">Anterior: {hud.ultimoResultado}</p>}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2 bg-black/15" aria-hidden>
          <div className="h-full bg-black/45 transition-[width] duration-150" style={{ width: `${Math.round(hud.progresso * 100)}%` }} />
        </div>
      </section>

      {/* Câmera (ou gabarito grande no modo sem câmera) */}
      <section inert={cobertoPorPopup} aria-hidden={cobertoPorPopup || undefined} className={`relative min-h-0 ${descansando ? "h-0" : "flex-1"}`}>
        {comCamera ? (
          <>
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
            <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <Gabarito exercicio={bloco.exercicioId} tamanho={210} />
            <p className="text-base leading-relaxed text-white/75">{dicaDoGabarito(bloco.exercicioId)}</p>
          </div>
        )}

        {comCamera && mostrarGabarito && !descansando && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-2xl bg-black/65 p-1.5 text-center text-white/80">
            <Gabarito exercicio={bloco.exercicioId} tamanho={sustentar ? 118 : 96} />
            <p className="text-[11px] font-bold uppercase tracking-wide">{sustentar ? "Posição esperada" : "Gabarito"}</p>
          </div>
        )}

        {respiracao && <Respiracao />}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-10">
          {hud.feedback && (
            <p role="alert" className="rounded-2xl bg-ruim px-5 py-2.5 text-center text-2xl font-black text-black">
              {hud.feedback}
            </p>
          )}
          {comCamera && hud.fora && fase.tipo === "trabalho" && (
            <p className="numero-camera text-center text-xl font-black text-ruim">Não estou te vendo. Volte para o quadro.</p>
          )}
          {hud.lento && <p className="text-sm font-semibold text-atencao">A câmera está lenta neste aparelho; a contagem pode falhar.</p>}
          {comCamera && hud.indicadores.length > 0 && fase.tipo === "trabalho" && (
            <dl className="grid w-full auto-cols-fr grid-flow-col gap-2">
              {hud.indicadores.map((i) => (
                <div key={i.rotulo} className="rounded-xl bg-black/65 px-2 py-1.5 text-center">
                  <dd className={`text-xl font-black tabular-nums ${i.bom ? "text-bom" : "text-atencao"}`}>{i.valor}</dd>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{i.rotulo}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* Rodapé: começar agora, feito (sem câmera) e senti dor */}
      <footer inert={cobertoPorPopup} aria-hidden={cobertoPorPopup || undefined} className="flex shrink-0 items-center gap-2 bg-black px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button onClick={() => pausar("dor")} className="h-12 shrink-0 rounded-full border border-white/30 px-4 text-base font-bold active:bg-white/15">
          Senti dor
        </button>
        {!comCamera && fase.tipo === "trabalho" && !fase.sustentar && fase.alvoReps !== undefined && !(fase.emom && hud.emomCumprido) && (
          <button onClick={() => acaoRef.current("feito")} className="h-14 flex-1 rounded-full bg-mel text-lg font-black text-black active:bg-mel-forte">
            Feito: {fase.alvoReps} reps
          </button>
        )}
      </footer>

      {popupAberto && (
        <PopupPrepare
          nome={bloco.exercicio}
          exercicioId={bloco.exercicioId}
          bloco={linha.estrutura.blocos[exIndice]}
          exercicio={exercicios[exIndice]}
          segundos={Math.ceil((hud.restanteMs ?? 0) / 1000)}
          progresso={hud.progresso}
          primeiro={hud.indice === 0}
          inerte={modal !== null}
          aoSair={() => pausar("sair")}
          aoComecar={() => acaoRef.current("pular")}
        />
      )}

      {modal === "dor" && (
        <div role="dialog" aria-modal="true" aria-label="Senti dor" className="absolute inset-0 z-20 flex items-end bg-black/75">
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
        <div role="dialog" aria-modal="true" aria-label="Encerrar o desafio" className="absolute inset-0 z-20 flex items-end bg-black/75">
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

/**
 * Pop-up "PREPARE-SE": aparece antes do primeiro esforço de cada exercício,
 * com as instruções rápidas e a contagem regressiva. "Ok, let's hive" pula a
 * contagem e começa na hora.
 */
function PopupPrepare({
  nome, exercicioId, bloco, exercicio, segundos, progresso, primeiro, inerte, aoSair, aoComecar,
}: {
  nome: string;
  exercicioId: string;
  bloco: Bloco | undefined;
  exercicio: ExercicioMetodo | undefined;
  segundos: number;
  progresso: number;
  primeiro: boolean;
  inerte: boolean;
  aoSair: () => void;
  aoComecar: () => void;
}) {
  return (
    <div inert={inerte} aria-hidden={inerte || undefined} role="dialog" aria-modal="true" aria-label={`Prepare-se: ${nome}`} className="absolute inset-0 z-20 flex flex-col bg-[#F5F2EA] text-black">
      <div className="flex items-center justify-between px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button onClick={aoSair} aria-label="Encerrar o desafio" className="flex h-12 w-12 items-center justify-center rounded-full text-black/60 active:bg-black/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="pr-4 text-sm font-black uppercase tracking-[0.18em] text-black/60">Prepare-se</p>
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
        {primeiro && <p className="mt-1 text-[15px] font-semibold text-black/75">Afaste-se até o corpo inteiro aparecer na câmera.</p>}
      </div>
      <div className="flex flex-col items-center gap-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
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

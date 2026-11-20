"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { abrirCameraFrontal, fecharCamera } from "@/camera/camera";
import { acompanharVideo, desenharEsqueleto } from "@/camera/desenhar-esqueleto";
import { criarDetector, type Detector } from "@/camera/pose";
import { som } from "@/camera/som";
import { botaoPrimario, botaoSecundario, campoTexto } from "@/componentes/estilos";
import { AmostradorSerie, concordancia } from "@/dominio/calibracao";
import { exercicioPorId } from "@/exercicios";
import { Motor, VISIBILIDADE_MINIMA_PADRAO } from "@/motor/motor";
import { gruposObrigatorios } from "@/motor/pontos";
import { salvarSerie } from "./acoes";

export interface ExercicioCalibravel {
  id: string;
  nome: string;
  tipo: "reps" | "tempo";
  camera: string;
  calibrado: boolean;
}

const POSICOES = ["Chão · frente", "Chão · lado", "Mesa · frente", "Mesa · lado", "45°", "Aos pés"];

type Etapa = "configurar" | "pronto" | "serie" | "revisao";

interface Resultado {
  appReps: number;
  appTempoS: number;
  profReps: number;
  profTempoS: number;
  duracaoS: number;
  fps: number | null;
  serieTemporal: [number, number][];
}

/**
 * Etapa C: o aluno faz uma série com a câmera e o professor conta junto.
 * A contagem do app fica escondida durante a série (para não influenciar quem
 * conta) e só aparece na revisão, ao lado da do professor.
 */
export function Calibrar({ exercicios }: { exercicios: ExercicioCalibravel[] }) {
  const router = useRouter();
  const [exercicioId, setExercicioId] = useState(exercicios.find((e) => !e.calibrado)?.id ?? exercicios[0]?.id ?? "");
  const [pessoa, setPessoa] = useState("");
  const [posicao, setPosicao] = useState(POSICOES[0]);
  const [observacao, setObservacao] = useState("");
  const [etapa, setEtapa] = useState<Etapa>("configurar");
  const [cameraAberta, setCameraAberta] = useState(false);
  const [erro, setErro] = useState("");
  const [corpoVisivel, setCorpoVisivel] = useState(false);
  const [fpsAgora, setFpsAgora] = useState<number | null>(null);
  const [profReps, setProfReps] = useState(0);
  const [profTempoMs, setProfTempoMs] = useState(0);
  const [segurando, setSegurando] = useState(false);
  const [decorridoS, setDecorridoS] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [salvando, iniciarSalvar] = useTransition();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const motorRef = useRef<Motor | null>(null);
  const amostradorRef = useRef<AmostradorSerie | null>(null);
  const inicioSerieRef = useRef(0);
  const seguraDesdeRef = useRef<number | null>(null);
  const fpsRef = useRef({ quadros: 0, inicio: 0, somaFps: 0, janelas: 0 });
  const rafRef = useRef(0);

  const exercicio = exercicios.find((e) => e.id === exercicioId);
  const def = exercicioPorId(exercicioId);
  const tipo = exercicio?.tipo ?? "reps";

  // Fecha câmera e detector ao sair da página.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      fecharCamera(streamRef.current);
      try {
        detectorRef.current?.landmarker.close();
      } catch {
        // Já fechado.
      }
    },
    [],
  );

  // O laço lê o exercício por ref (o requestAnimationFrame não vê o estado novo).
  const exercicioIdRef = useRef(exercicioId);
  useEffect(() => {
    exercicioIdRef.current = exercicioId;
  }, [exercicioId]);

  // Laço da câmera: roda enquanto a câmera estiver aberta. A imagem é analisada aqui, no aparelho.
  useEffect(() => {
    if (!cameraAberta) return;
    let ultimoTempoVideo = -1;
    const laco = () => {
      rafRef.current = requestAnimationFrame(laco);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;
      const definicao = exercicioPorId(exercicioIdRef.current);
      if (!video || !canvas || !detector || video.readyState < 2 || !definicao || video.currentTime === ultimoTempoVideo) return;
      ultimoTempoVideo = video.currentTime;
      const agora = performance.now();
      let pontos = null;
      let mundo = null;
      try {
        const r = detector.landmarker.detectForVideo(video, agora);
        pontos = r.landmarks[0] ?? null;
        mundo = r.worldLandmarks[0] ?? null;
      } catch {
        return;
      }
      const f = fpsRef.current;
      f.quadros++;
      if (agora - f.inicio >= 2000) {
        const fps = (f.quadros * 1000) / (agora - f.inicio);
        if (motorRef.current) {
          f.somaFps += fps;
          f.janelas++;
        }
        setFpsAgora(Math.round(fps));
        f.quadros = 0;
        f.inicio = agora;
      }
      const grupos = gruposObrigatorios(definicao.pontos_obrigatorios);
      const visivel = !!pontos && grupos.every((g) => g.some((i) => (pontos![i].visibility ?? 1) >= VISIBILIDADE_MINIMA_PADRAO));
      setCorpoVisivel(visivel);
      const motor = motorRef.current;
      if (motor) {
        // Sem som de rep válida: o professor conta às cegas, sem saber o que o app contou.
        motor.processar({ t: agora, pontos, mundo });
        amostradorRef.current?.registrar(agora, motor.estado.medidas.medida);
        setDecorridoS(Math.floor((agora - inicioSerieRef.current) / 1000));
      }
      const ctx = canvas.getContext("2d");
      if (ctx) {
        acompanharVideo(canvas, video);
        desenharEsqueleto(ctx, pontos, { valido: visivel, erro: false, visibilidadeMinima: VISIBILIDADE_MINIMA_PADRAO });
      }
    };

    rafRef.current = requestAnimationFrame(laco);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cameraAberta]);

  const abrirCamera = async () => {
    setErro("");
    if (!pessoa.trim()) return setErro("Escreva um rótulo curto para quem vai treinar (ex.: A1).");
    try {
      const stream = await abrirCameraFrontal();
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
    } catch {
      return setErro("Não consegui abrir a câmera. Confira a permissão do navegador.");
    }
    try {
      detectorRef.current ??= await criarDetector("lite");
    } catch {
      return setErro("A câmera abriu, mas o detector de pose não carregou. Confira a internet e recarregue a página.");
    }
    fpsRef.current = { quadros: 0, inicio: performance.now(), somaFps: 0, janelas: 0 };
    setCameraAberta(true);
    setEtapa("pronto");
  };

  const comecarSerie = () => {
    if (!def) return;
    motorRef.current = new Motor(def, {
      proporcao: videoRef.current ? videoRef.current.videoWidth / videoRef.current.videoHeight : 1,
      visibilidadeMinima: VISIBILIDADE_MINIMA_PADRAO,
    });
    amostradorRef.current = new AmostradorSerie(10);
    inicioSerieRef.current = performance.now();
    fpsRef.current.somaFps = 0;
    fpsRef.current.janelas = 0;
    seguraDesdeRef.current = null;
    setProfReps(0);
    setProfTempoMs(0);
    setDecorridoS(0);
    setResultado(null);
    setMensagem("");
    som.largada();
    setEtapa("serie");
  };

  const soltar = () => {
    if (seguraDesdeRef.current !== null) {
      const ms = performance.now() - seguraDesdeRef.current;
      seguraDesdeRef.current = null;
      setProfTempoMs((t) => t + ms);
    }
    setSegurando(false);
  };

  const terminarSerie = () => {
    soltar();
    const motor = motorRef.current;
    if (!motor) return;
    const estado = motor.estado;
    const f = fpsRef.current;
    const profTempoFinal = profTempoMs + (seguraDesdeRef.current !== null ? performance.now() - seguraDesdeRef.current : 0);
    setResultado({
      appReps: estado.repsValidas,
      appTempoS: Math.round(estado.tempoValidoMs / 100) / 10,
      profReps,
      profTempoS: Math.round(profTempoFinal / 100) / 10,
      duracaoS: Math.round((performance.now() - inicioSerieRef.current) / 100) / 10,
      fps: f.janelas > 0 ? Math.round((f.somaFps / f.janelas) * 10) / 10 : null,
      serieTemporal: amostradorRef.current?.pontos ?? [],
    });
    motorRef.current = null;
    som.fim();
    setEtapa("revisao");
  };

  const salvar = () => {
    if (!resultado || !exercicio) return;
    iniciarSalvar(async () => {
      const r = await salvarSerie({
        exercicio_id: exercicio.id,
        tipo,
        pessoa: pessoa.trim().slice(0, 24),
        app_reps: tipo === "reps" ? resultado.appReps : null,
        prof_reps: tipo === "reps" ? resultado.profReps : null,
        app_tempo_s: tipo === "tempo" ? resultado.appTempoS : null,
        prof_tempo_s: tipo === "tempo" ? resultado.profTempoS : null,
        duracao_s: resultado.duracaoS,
        fps_medio: resultado.fps,
        posicao_celular: posicao,
        serie_temporal: resultado.serieTemporal,
        observacao: observacao.trim().slice(0, 280),
      });
      setMensagem(r.mensagem);
      if (r.ok) {
        setObservacao("");
        setEtapa("pronto");
        router.refresh();
      }
    });
  };

  const comparacao = resultado
    ? tipo === "reps"
      ? { app: `${resultado.appReps}`, prof: `${resultado.profReps}`, c: concordancia(resultado.appReps, resultado.profReps) }
      : { app: `${resultado.appTempoS.toFixed(1)} s`, prof: `${resultado.profTempoS.toFixed(1)} s`, c: concordancia(resultado.appTempoS, resultado.profTempoS) }
    : null;

  const bloqueiaConfig = etapa === "serie" || etapa === "revisao";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-borda p-4">
      <h2 className="text-xl font-black">Nova série</h2>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Exercício
        <select value={exercicioId} disabled={bloqueiaConfig} onChange={(e) => setExercicioId(e.target.value)} className={campoTexto}>
          {exercicios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.calibrado ? "✓ " : ""}
              {e.nome}
            </option>
          ))}
        </select>
        {exercicio && (
          <span className="text-xs font-normal text-apagado">
            Conta {exercicio.tipo === "reps" ? "repetições" : "tempo na posição"} · câmera {exercicio.camera === "lateral" ? "de lado" : "de frente"}
            {exercicio.calibrado ? " · já calibrado no catálogo" : ""}
          </span>
        )}
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Quem treina
          <input
            value={pessoa}
            disabled={bloqueiaConfig}
            maxLength={24}
            onChange={(e) => setPessoa(e.target.value)}
            placeholder="ex.: A1"
            className={campoTexto}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Celular
          <select value={posicao} disabled={bloqueiaConfig} onChange={(e) => setPosicao(e.target.value)} className={campoTexto}>
            {POSICOES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="-mt-2 text-xs text-apagado">Use só um rótulo curto (A1, B2…), nunca o nome completo do aluno.</p>

      <div className={`relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-black ${etapa === "configurar" ? "hidden" : ""}`}>
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        <div className="absolute left-2 top-2 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold">
          <span className={`h-2.5 w-2.5 rounded-full ${corpoVisivel ? "bg-mel" : "bg-white/40"}`} />
          {corpoVisivel ? "Corpo na tela" : "Corpo fora da tela"}
          {fpsAgora !== null ? ` · ${fpsAgora} fps` : ""}
        </div>
        {etapa === "serie" && (
          <p className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold">{decorridoS} s</p>
        )}
      </div>

      {erro && <p className="text-sm font-semibold text-red-400">{erro}</p>}

      {etapa === "configurar" && (
        <button onClick={abrirCamera} className={botaoPrimario}>
          Abrir câmera
        </button>
      )}

      {etapa === "pronto" && (
        <>
          <p className="text-sm text-apagado">
            {tipo === "reps"
              ? "Na série, toque +1 a cada repetição que VOCÊ considera válida. O número do app fica escondido até o fim."
              : "Na série, segure o botão enquanto a posição estiver certa e solte quando sair. O tempo do app fica escondido até o fim."}
          </p>
          <button onClick={comecarSerie} disabled={!corpoVisivel} className={botaoPrimario}>
            {corpoVisivel ? "Começar série" : "Enquadre o corpo inteiro para começar"}
          </button>
        </>
      )}

      {etapa === "serie" && (
        <div className="flex flex-col gap-3">
          {tipo === "reps" ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setProfReps((n) => Math.max(0, n - 1))}
                aria-label="Desfazer uma"
                className="h-20 w-20 shrink-0 rounded-2xl border border-borda text-2xl font-black active:bg-fundo"
              >
                −1
              </button>
              <button
                onClick={() => {
                  setProfReps((n) => n + 1);
                  navigator.vibrate?.(15);
                }}
                className="h-20 flex-1 rounded-2xl bg-mel text-4xl font-black text-black active:bg-mel-forte"
              >
                +1 <span className="fonte-numero ml-2 text-3xl">({profReps})</span>
              </button>
            </div>
          ) : (
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                seguraDesdeRef.current = performance.now();
                setSegurando(true);
              }}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              className={`h-24 rounded-2xl text-xl font-black text-black select-none ${segurando ? "bg-mel-forte" : "bg-mel"}`}
            >
              {segurando ? "Contando… solte quando sair da posição" : `Segure enquanto está certo (${(profTempoMs / 1000).toFixed(1)} s)`}
            </button>
          )}
          <button onClick={terminarSerie} className={botaoSecundario}>
            Terminar série
          </button>
        </div>
      )}

      {etapa === "revisao" && resultado && comparacao && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-superficie p-3">
              <p className="text-xs font-bold uppercase text-apagado">App</p>
              <p className="fonte-numero text-3xl">{comparacao.app}</p>
            </div>
            <div className="rounded-xl bg-superficie p-3">
              <p className="text-xs font-bold uppercase text-apagado">Você</p>
              <p className="fonte-numero text-3xl">{comparacao.prof}</p>
            </div>
            <div className="rounded-xl bg-superficie p-3">
              <p className="text-xs font-bold uppercase text-apagado">Bateu</p>
              <p className={`fonte-numero text-3xl ${comparacao.c >= 0.9 ? "text-mel" : ""}`}>{Math.round(comparacao.c * 100)}%</p>
            </div>
          </div>
          <p className="text-xs text-apagado">
            {resultado.duracaoS.toFixed(0)} s de série{resultado.fps ? ` · ${Math.round(resultado.fps)} fps em média` : ""}
            {resultado.fps !== null && resultado.fps < 15 ? " · fps baixo: a contagem pode falhar por causa do aparelho" : ""}
          </p>
          <input
            value={observacao}
            maxLength={280}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação (opcional): ex. saiu do quadro no fim, luz contra"
            className={campoTexto}
          />
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setEtapa("pronto")} disabled={salvando} className={botaoSecundario}>
              Descartar
            </button>
            <button onClick={salvar} disabled={salvando} className={botaoPrimario}>
              {salvando ? "Salvando…" : "Salvar série"}
            </button>
          </div>
        </div>
      )}

      {mensagem && <p className="text-sm font-semibold text-mel">{mensagem}</p>}
    </section>
  );
}

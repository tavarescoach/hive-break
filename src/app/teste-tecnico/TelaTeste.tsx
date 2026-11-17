"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { abrirCameraFrontal, fecharCamera } from "@/camera/camera";
import { desenharEsqueleto } from "@/camera/desenhar-esqueleto";
import { criarDetector, type Detector } from "@/camera/pose";
import { som } from "@/camera/som";
import { serializarFrame, type FrameFixture } from "@/motor/fixture";
import { Motor, VISIBILIDADE_MINIMA_PADRAO } from "@/motor/motor";
import { indicesDoPonto } from "@/motor/pontos";
import type { EventoMotor, Frame, Lado } from "@/motor/tipos";
import { ehSustentacao, formatarTempo, type ConfigTeste, type ResultadoTeste } from "./tipos";

type Etapa = "carregando" | "enquadrando" | "contagem" | "ativo" | "fim";

interface Hud {
  etapa: Etapa;
  regressiva: number;
  reps: number;
  parciais: number;
  tempoMs: number;
  fase: string | null;
  naPosicao: boolean;
  lado: Lado | null;
  fora: boolean;
  corpoVisivel: boolean;
  feedback: string | null;
  fps: number;
  medidas: Record<string, number>;
  visibilidade: number;
  motor: string;
}

const HUD_INICIAL: Hud = {
  etapa: "carregando",
  regressiva: 0,
  reps: 0,
  parciais: 0,
  tempoMs: 0,
  fase: null,
  naPosicao: false,
  lado: null,
  fora: false,
  corpoVisivel: false,
  feedback: null,
  fps: 0,
  medidas: {},
  visibilidade: 0,
  motor: "",
};

const VISIBILIDADE_MINIMA = VISIBILIDADE_MINIMA_PADRAO;
/** Corpo visível por este tempo dispara a contagem regressiva sozinho. */
const ENQUADRADO_MS = 1500;
const REGRESSIVA_S = 5;
/** Limite da gravação de landmarks: 90 s a 30 fps. */
const LIMITE_GRAVACAO = 2700;

interface Props {
  config: ConfigTeste;
  aoFim: (resultado: ResultadoTeste) => void;
  aoSair: () => void;
}

export function TelaTeste({ config, aoFim, aoSair }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const comecarRef = useRef<() => void>(() => {});
  const encerrarRef = useRef<() => void>(() => {});
  const [hud, setHud] = useState<Hud>(HUD_INICIAL);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState(false);
  const entregar = useEffectEvent(aoFim);

  const { def, meta, modelo, gravar } = config;
  const sustentacao = ehSustentacao(def);

  useEffect(() => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const obrigatorios = [...new Set(def.pontos_obrigatorios.flatMap(indicesDoPonto))];

    let cancelado = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let detector: Detector | null = null;
    let trava: WakeLockSentinel | null = null;
    let motor: Motor | null = null;
    let proporcao = 1;

    let etapa: Etapa = "carregando";
    let ultimoTempoVideo = -1;
    let visivelDesde: number | null = null;
    let fimContagem = 0;
    let regressiva = 0;
    let inicioAtivo = 0;
    let quadrosAtivos = 0;
    let fps = 0;
    let quadrosJanela = 0;
    let inicioJanela = 0;
    let ultimoHud = 0;
    let feedback: { texto: string; ate: number } | null = null;
    let cortada = false;
    const gravacao: FrameFixture[] = [];

    const avisar = (texto: string | undefined, agora: number) => {
      if (texto) feedback = { texto, ate: agora + 2500 };
    };

    const tratar = (evento: EventoMotor, agora: number) => {
      switch (evento.tipo) {
        case "rep_valida":
          som.valida();
          break;
        case "rep_parcial":
          som.parcial();
          avisar(evento.feedback, agora);
          break;
        case "rep_rapida":
          avisar("Rápido demais para contar", agora);
          break;
        case "erro":
          avisar(evento.feedback, agora);
          break;
        case "posicao_inicio":
          som.tique();
          break;
        case "posicao_perdida":
          if (evento.feedback) som.parcial();
          avisar(evento.feedback, agora);
          break;
      }
    };

    const comecarContagem = (agora: number) => {
      if (etapa !== "enquadrando") return;
      etapa = "contagem";
      fimContagem = agora + REGRESSIVA_S * 1000;
      regressiva = REGRESSIVA_S + 1;
    };

    const finalizar = (agora: number) => {
      if (etapa === "fim" || !motor || !detector) return;
      etapa = "fim";
      som.fim();
      const kpis = motor.kpis();
      const duracaoS = Math.max(0.001, (agora - inicioAtivo) / 1000);
      const resultado: ResultadoTeste = {
        config,
        unidade: sustentacao ? "s" : "reps",
        contagem: sustentacao ? Math.round(kpis.tempo_valido_s) : kpis.reps_validas,
        kpis,
        fpsMedio: Math.round((quadrosAtivos / duracaoS) * 10) / 10,
        delegado: detector.delegado,
        proporcao,
        gravacao: gravar ? gravacao : null,
        gravacaoCortada: cortada,
      };
      window.setTimeout(() => {
        if (!cancelado) entregar(resultado);
      }, 700);
    };

    comecarRef.current = () => comecarContagem(performance.now());
    encerrarRef.current = () => finalizar(performance.now());

    const quadro = () => {
      if (cancelado) return;
      raf = requestAnimationFrame(quadro);
      if (!detector || video.readyState < 2 || video.currentTime === ultimoTempoVideo) return;
      ultimoTempoVideo = video.currentTime;

      const agora = performance.now();
      let pontos: Frame["pontos"] = null;
      let mundo: Frame["mundo"] = null;
      try {
        // A imagem é analisada aqui, no aparelho. Daqui só saem os pontos do corpo.
        const resultado = detector.landmarker.detectForVideo(video, agora);
        pontos = resultado.landmarks[0] ?? null;
        mundo = resultado.worldLandmarks[0] ?? null;
      } catch {
        return;
      }
      const frame: Frame = { t: agora, pontos, mundo };

      quadrosJanela++;
      if (agora - inicioJanela >= 1000) {
        fps = (quadrosJanela * 1000) / (agora - inicioJanela);
        quadrosJanela = 0;
        inicioJanela = agora;
      }

      const visibilidade = pontos ? Math.min(...obrigatorios.map((i) => pontos[i].visibility ?? 1)) : 0;
      const corpoVisivel = visibilidade >= VISIBILIDADE_MINIMA;
      let erroAtivo = false;
      let forcar = false;

      if (etapa === "enquadrando") {
        if (corpoVisivel) {
          visivelDesde ??= agora;
          if (agora - visivelDesde >= ENQUADRADO_MS) comecarContagem(agora);
        } else {
          visivelDesde = null;
        }
      }
      if (etapa === "contagem") {
        const restante = Math.ceil((fimContagem - agora) / 1000);
        if (restante !== regressiva) {
          regressiva = restante;
          forcar = true;
          if (restante > 0) som.tique();
        }
        if (restante <= 0) {
          etapa = "ativo";
          motor = new Motor(def, { proporcao, visibilidadeMinima: VISIBILIDADE_MINIMA });
          inicioAtivo = agora;
          som.largada();
        }
      } else if (etapa === "ativo" && motor) {
        quadrosAtivos++;
        const eventos = motor.processar(frame);
        if (gravar) {
          if (gravacao.length < LIMITE_GRAVACAO) gravacao.push(serializarFrame({ ...frame, t: agora - inicioAtivo }));
          else cortada = true;
        }
        for (const evento of eventos) tratar(evento, agora);
        forcar ||= eventos.length > 0;
        const estado = motor.estado;
        erroAtivo = estado.errosAtivos.length > 0;
        const bateuMeta = meta > 0 && (sustentacao ? estado.tempoValidoMs >= meta * 1000 : estado.repsValidas >= meta);
        if (bateuMeta) finalizar(agora);
      }

      desenharEsqueleto(ctx, pontos, { valido: corpoVisivel, erro: erroAtivo, visibilidadeMinima: VISIBILIDADE_MINIMA });

      if (forcar || agora - ultimoHud >= 100) {
        ultimoHud = agora;
        const estado = motor?.estado;
        setHud({
          etapa,
          regressiva: Math.max(0, regressiva),
          reps: estado?.repsValidas ?? 0,
          parciais: estado?.repsParciais ?? 0,
          tempoMs: estado?.tempoValidoMs ?? 0,
          fase: estado?.fase ?? null,
          naPosicao: estado?.naPosicao ?? false,
          lado: estado?.lado ?? null,
          fora: estado?.foraDoQuadro ?? false,
          corpoVisivel,
          feedback: feedback && agora < feedback.ate ? feedback.texto : null,
          fps: Math.round(fps),
          medidas: estado?.medidas ?? {},
          visibilidade,
          motor: `${detector.modelo} · ${detector.delegado}`,
        });
      }
    };

    const iniciar = async () => {
      stream = await abrirCameraFrontal();
      if (cancelado) return fecharCamera(stream);
      video.srcObject = stream;
      await video.play();
      if (cancelado) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      proporcao = video.videoWidth / video.videoHeight;

      detector = await criarDetector(modelo);
      if (cancelado) return detector.landmarker.close();

      try {
        trava = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Sem Wake Lock: a tela pode apagar em desafios longos.
      }
      etapa = "enquadrando";
      inicioJanela = performance.now();
      raf = requestAnimationFrame(quadro);
    };

    iniciar().catch((falha: Error) => {
      if (!cancelado) setErro(falha.message || "Não consegui iniciar a câmera.");
    });

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      fecharCamera(stream);
      video.srcObject = null;
      try {
        detector?.landmarker.close();
      } catch {
        // Já estava fechado.
      }
      void trava?.release().catch(() => {});
    };
  }, [config, def, meta, modelo, gravar, sustentacao]);

  if (erro) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-6 px-5">
        <h1 className="text-2xl font-bold">Não deu para abrir a câmera</h1>
        <p className="text-base leading-relaxed text-apagado">{erro}</p>
        <button onClick={aoSair} className="h-14 rounded-2xl bg-mel text-lg font-bold text-black">
          Voltar
        </button>
      </main>
    );
  }

  const ativo = hud.etapa === "ativo" || hud.etapa === "fim";
  const contador = sustentacao
    ? meta > 0
      ? `${formatarTempo(hud.tempoMs)}/${formatarTempo(meta * 1000)}`
      : formatarTempo(hud.tempoMs)
    : meta > 0
      ? `${hud.reps}/${meta}`
      : `${hud.reps}`;

  let situacao = "";
  if (hud.etapa === "carregando") situacao = "Abrindo a câmera e carregando o detector…";
  else if (hud.etapa === "enquadrando")
    situacao = hud.corpoVisivel ? "Boa! Fique parado, já vai começar." : "Afaste-se até aparecer o corpo inteiro, da cabeça aos pés.";
  else if (hud.etapa === "contagem") situacao = "Prepare-se";
  else if (hud.etapa === "fim") situacao = "Feito!";
  else if (hud.fora) situacao = "Não estou te vendo. Volte para o quadro.";
  else if (sustentacao) {
    situacao = hud.naPosicao ? `Pé ${hud.lado === "e" ? "esquerdo" : "direito"} no ar · segure` : "Tire um pé do chão";
  }

  return (
    <main className="fixed inset-0 z-10 overflow-hidden bg-black text-white">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />

      {/* Topo: exercício e encerrar */}
      <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-lg font-bold leading-tight">{def.nome}</p>
          <p className="text-sm text-white/75">
            {meta === 0 ? "Modo livre" : "Teste técnico"}
            {hud.motor && (
              <>
                {" · "}
                <span className={hud.fps >= 20 ? "text-bom" : hud.fps >= 12 ? "text-atencao" : "text-ruim"}>{hud.fps} fps</span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => (ativo ? encerrarRef.current() : aoSair())}
          className="h-12 shrink-0 rounded-full bg-white/15 px-5 text-base font-semibold backdrop-blur active:bg-white/25"
        >
          {ativo ? "Encerrar" : "Voltar"}
        </button>
      </header>

      {/* Centro: contador grande */}
      <div className="pointer-events-none absolute inset-x-0 top-[13%] flex flex-col items-center px-4 text-center">
        {hud.etapa === "contagem" ? (
          <p key={hud.regressiva} className="numero-camera pulso-rep text-[9rem] font-black leading-none">
            {hud.regressiva}
          </p>
        ) : ativo ? (
          <p
            key={sustentacao ? "tempo" : hud.reps}
            role="status"
            aria-live="polite"
            className={`numero-camera font-black leading-none ${sustentacao ? "" : "pulso-rep"} ${
              contador.length > 7 ? "text-[4.5rem]" : contador.length > 4 ? "text-[6rem]" : "text-[8rem]"
            } ${hud.fora ? "opacity-40" : ""}`}
          >
            {contador}
          </p>
        ) : null}
        {ativo && !sustentacao && hud.parciais > 0 && (
          <p className="numero-camera mt-1 text-xl font-bold text-atencao">
            {hud.parciais} {hud.parciais === 1 ? "parcial" : "parciais"}
          </p>
        )}
      </div>

      {/* Faixa inferior: situação, feedback e painel */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        {hud.feedback && (
          <p role="alert" className="self-center rounded-2xl bg-ruim px-5 py-3 text-center text-2xl font-black text-black">
            {hud.feedback}
          </p>
        )}
        {situacao && (
          <p
            className={`numero-camera text-center text-xl font-bold ${
              hud.fora && hud.etapa === "ativo" ? "text-ruim" : hud.corpoVisivel || ativo ? "text-white" : "text-atencao"
            }`}
          >
            {situacao}
          </p>
        )}
        {hud.etapa === "enquadrando" && (
          <button
            onClick={() => comecarRef.current()}
            className="h-14 rounded-2xl bg-mel text-lg font-bold text-black active:bg-mel-forte"
          >
            Começar agora
          </button>
        )}

        <div className="flex items-end justify-between gap-3">
          {painel ? (
            <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-xl bg-black/60 p-3 font-mono text-[12px] leading-snug text-white/90">
              <dt className="text-white/55">fps</dt>
              <dd className={hud.fps >= 20 ? "text-bom" : hud.fps >= 12 ? "text-atencao" : "text-ruim"}>{hud.fps}</dd>
              <dt className="text-white/55">detector</dt>
              <dd>{hud.motor || "…"}</dd>
              <dt className="text-white/55">visibilidade</dt>
              <dd className={hud.corpoVisivel ? "text-bom" : "text-ruim"}>
                {hud.visibilidade.toFixed(2)} (mín. {VISIBILIDADE_MINIMA})
              </dd>
              {!sustentacao && (
                <>
                  <dt className="text-white/55">fase</dt>
                  <dd>{hud.fase ?? "—"}</dd>
                </>
              )}
              {Object.entries(hud.medidas).map(([nome, valor]) => (
                <div key={nome} className="contents">
                  <dt className="text-white/55">{nome}</dt>
                  <dd>{Number.isFinite(valor) ? valor.toFixed(Math.abs(valor) >= 10 ? 0 : 2) : "—"}</dd>
                </div>
              ))}
              {gravar && (
                <>
                  <dt className="text-white/55">gravação</dt>
                  <dd className="text-ruim">{hud.etapa === "ativo" ? "● gravando pontos" : "aguardando"}</dd>
                </>
              )}
            </dl>
          ) : (
            <span className="flex-1" />
          )}
          <button
            onClick={() => setPainel((v) => !v)}
            aria-pressed={painel}
            className="h-12 shrink-0 rounded-full bg-white/15 px-4 text-sm font-semibold backdrop-blur active:bg-white/25"
          >
            {painel ? "Ocultar medidas" : "Medidas"}
          </button>
        </div>
      </div>
    </main>
  );
}

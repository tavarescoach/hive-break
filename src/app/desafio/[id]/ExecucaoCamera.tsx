"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { abrirCameraFrontal, fecharCamera } from "@/camera/camera";
import { desenharAlvo, desenharEsqueleto } from "@/camera/desenhar-esqueleto";
import { criarDetector, type Detector } from "@/camera/pose";
import { som } from "@/camera/som";
import { calarVoz, falar } from "@/camera/voz";
import { exercicioPorId } from "@/exercicios";
import { Motor } from "@/motor/motor";
import { gruposObrigatorios } from "@/motor/pontos";
import type { DefinicaoExercicio, EventoMotor, Frame, Kpis } from "@/motor/tipos";
import { registrarDor, type BlocoEnviado } from "./acoes";
import type { BlocoDesafio } from "./Desafio";

type Etapa = "carregando" | "posicionar" | "contagem" | "ativo" | "fim";

interface Indicador {
  rotulo: string;
  valor: string;
  /** Verde quando bom, amarelo quando pede atenção. */
  bom: boolean;
}

interface Hud {
  etapa: Etapa;
  indice: number;
  regressiva: number;
  contador: string;
  legenda: string;
  restanteS: number;
  fracao: number;
  indicadores: Indicador[];
  feedback: string | null;
  fora: boolean;
  corpoVisivel: boolean;
  fps: number;
}

const HUD_INICIAL: Hud = {
  etapa: "carregando", indice: 0, regressiva: 0, contador: "0", legenda: "", restanteS: 0, fracao: 0,
  indicadores: [], feedback: null, fora: false, corpoVisivel: false, fps: 0,
};

const VISIBILIDADE_MINIMA = 0.6;
/** Corpo visível por este tempo dispara a contagem regressiva. */
const ENQUADRADO_MS = 1200;
const REGRESSIVA_S = 3;
const REGIOES = [
  ["joelho", "Joelho"], ["ombro", "Ombro"], ["lombar", "Lombar"], ["punho", "Punho"],
  ["quadril", "Quadril"], ["tornozelo", "Tornozelo"], ["pescoco", "Pescoço"], ["outra", "Outro lugar"],
] as const;

const relogio = (segundos: number) => `${Math.floor(segundos / 60)}:${String(Math.max(0, Math.floor(segundos)) % 60).padStart(2, "0")}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const ehSustentacao = (def: DefinicaoExercicio) => ["isometria", "postura", "equilibrio", "respiracao"].includes(def.formato);

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

/** Só números agregados saem daqui para o servidor. */
function numerosDoBloco(ordem: number, def: DefinicaoExercicio, k: Kpis): BlocoEnviado {
  return {
    ordem,
    reps_validas: def.formato === "precisao" ? k.acertos : k.reps_validas,
    reps_parciais: k.reps_parciais,
    tempo_valido_s: k.tempo_valido_s,
    fora_quadro_pct: k.fora_quadro_pct,
    kpis: {
      amplitude_media: k.amplitude_media, cadencia: k.cadencia, regularidade: k.regularidade, indice_tecnico: k.indice_tecnico,
      tempo_excentrico: k.tempo_excentrico, tempo_concentrico: k.tempo_concentrico, simetria: k.simetria, estabilidade: k.estabilidade,
      pct_tempo_valido: k.pct_tempo_valido, precisao: k.precisao, tempo_reacao: k.tempo_reacao, reps_rapidas: k.reps_rapidas,
      tempo_trabalho_s: k.tempo_trabalho_s,
    },
  };
}

interface Props {
  id: string;
  titulo: string;
  blocos: BlocoDesafio[];
  aoFim: (numeros: BlocoEnviado[]) => void;
  aoSemCamera: (mensagem: string) => void;
}

/**
 * Execução do desafio com a câmera frontal: o motor conta repetições, mede o
 * tempo na posição e avisa erros de execução. O vídeo é analisado no aparelho.
 */
export function ExecucaoCamera({ id, titulo, blocos, aoFim, aoSemCamera }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const comecarRef = useRef<() => void>(() => {});
  const encerrarRef = useRef<() => void>(() => {});
  const pausadoRef = useRef(false);
  const [hud, setHud] = useState<Hud>(HUD_INICIAL);
  const [dor, setDor] = useState(false);
  const [enviandoDor, setEnviandoDor] = useState(false);
  const entregar = useEffectEvent(aoFim);
  const semCamera = useEffectEvent(aoSemCamera);

  useEffect(() => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let cancelado = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let detector: Detector | null = null;
    let trava: WakeLockSentinel | null = null;
    let proporcao = 1;

    let etapa: Etapa = "carregando";
    let indice = 0;
    let def: DefinicaoExercicio | null = null;
    let obrigatorios: number[][] = [];
    let motor: Motor | null = null;
    let restanteMs = 0;
    let ultimoT = 0;
    let ultimoTempoVideo = -1;
    let visivelDesde: number | null = null;
    let fimContagem = 0;
    let regressiva = 0;
    let ultimoSegundo = -1;
    let fps = 0;
    let quadrosJanela = 0;
    let inicioJanela = 0;
    let ultimoHud = 0;
    let ultimosKpis = 0;
    let chips: Indicador[] = [];
    let feedback: { texto: string; ate: number } | null = null;
    const resultados: BlocoEnviado[] = [];

    const avisar = (texto: string | undefined, agora: number) => {
      if (!texto) return;
      feedback = { texto, ate: agora + 2500 };
      falar(texto);
    };

    const tratar = (evento: EventoMotor, agora: number) => {
      switch (evento.tipo) {
        case "rep_valida":
        case "alvo_acerto":
          som.valida();
          break;
        case "rep_parcial":
          som.parcial();
          avisar(evento.feedback, agora);
          break;
        case "alvo_perdido":
          som.parcial();
          break;
        case "erro":
          avisar(evento.feedback, agora);
          break;
        case "posicao_inicio":
          som.tique();
          break;
        case "posicao_perdida":
          avisar(evento.feedback, agora);
          break;
        case "fora_quadro":
          falar("Não estou te vendo", true);
          break;
      }
    };

    const prepararBloco = (i: number) => {
      indice = i;
      motor = null;
      chips = [];
      visivelDesde = null;
      const bloco = blocos[i];
      def = exercicioPorId(bloco.exercicioId) ?? null;
      obrigatorios = def ? gruposObrigatorios(def.pontos_obrigatorios) : [];
      etapa = "posicionar";
      falar(`${bloco.exercicio}. ${bloco.lateral ? "Fique de lado para o celular." : "Fique de frente para o celular."}`, true);
    };

    const comecarContagem = (agora: number) => {
      if (etapa !== "posicionar") return;
      etapa = "contagem";
      fimContagem = agora + REGRESSIVA_S * 1000;
      regressiva = REGRESSIVA_S + 1;
    };

    const finalizar = () => {
      if (etapa === "fim") return;
      etapa = "fim";
      som.fim();
      calarVoz();
      window.setTimeout(() => {
        if (!cancelado) entregar(resultados);
      }, 700);
    };

    const fecharBloco = () => {
      if (motor && def) resultados.push(numerosDoBloco(blocos[indice].ordem, def, motor.kpis()));
      if (indice + 1 < blocos.length) prepararBloco(indice + 1);
      else finalizar();
    };

    comecarRef.current = () => comecarContagem(performance.now());
    // "Concluí": fecha o exercício em andamento e encerra o desafio com o que foi feito.
    encerrarRef.current = () => {
      if (etapa === "ativo" && motor && def) resultados.push(numerosDoBloco(blocos[indice].ordem, def, motor.kpis()));
      finalizar();
    };

    const quadro = () => {
      if (cancelado) return;
      raf = requestAnimationFrame(quadro);
      if (!detector || video.readyState < 2 || video.currentTime === ultimoTempoVideo) return;
      ultimoTempoVideo = video.currentTime;

      const agora = performance.now();
      const dt = Math.min(250, ultimoT ? agora - ultimoT : 0);
      ultimoT = agora;
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

      quadrosJanela++;
      if (agora - inicioJanela >= 1000) {
        fps = (quadrosJanela * 1000) / (agora - inicioJanela);
        quadrosJanela = 0;
        inicioJanela = agora;
      }

      const corpoVisivel =
        !!pontos && obrigatorios.every((grupo) => grupo.some((i) => (pontos[i].visibility ?? 1) >= VISIBILIDADE_MINIMA));
      let erroAtivo = false;
      let forcar = false;
      const pausado = pausadoRef.current;

      if (!pausado && etapa === "posicionar") {
        // Exercício sem regra de detecção (não deveria acontecer): pula.
        if (!def) fecharBloco();
        else if (corpoVisivel) {
          visivelDesde ??= agora;
          if (agora - visivelDesde >= ENQUADRADO_MS) comecarContagem(agora);
        } else {
          visivelDesde = null;
        }
      }
      if (!pausado && etapa === "contagem") {
        const restante = Math.ceil((fimContagem - agora) / 1000);
        if (restante !== regressiva) {
          regressiva = restante;
          forcar = true;
          if (restante > 0) som.tique();
        }
        if (restante <= 0 && def) {
          etapa = "ativo";
          motor = new Motor(def, { proporcao, visibilidadeMinima: VISIBILIDADE_MINIMA });
          restanteMs = blocos[indice].segundos * 1000;
          ultimoSegundo = -1;
          som.largada();
        }
      } else if (!pausado && etapa === "ativo" && motor && def) {
        const eventos = motor.processar({ t: agora, pontos, mundo });
        for (const evento of eventos) tratar(evento, agora);
        forcar ||= eventos.length > 0;
        const estado = motor.estado;
        erroAtivo = estado.errosAtivos.length > 0;
        // Perdeu a detecção: o tempo do exercício para até a pessoa voltar ao quadro.
        if (!estado.foraDoQuadro) restanteMs -= dt;
        const segundo = Math.ceil(restanteMs / 1000);
        if (segundo !== ultimoSegundo) {
          ultimoSegundo = segundo;
          if (segundo <= 3 && segundo > 0) som.tique();
        }
        if (agora - ultimosKpis >= 500) {
          ultimosKpis = agora;
          chips = indicadores(def, motor.kpis());
        }
        if (restanteMs <= 0) fecharBloco();
      }

      desenharEsqueleto(ctx, pontos, { valido: corpoVisivel, erro: erroAtivo, visibilidadeMinima: VISIBILIDADE_MINIMA });
      const alvo = etapa === "ativo" ? motor?.estado.alvo : null;
      if (alvo) desenharAlvo(ctx, alvo);

      if (forcar || agora - ultimoHud >= 100) {
        ultimoHud = agora;
        const estado = etapa === "ativo" ? motor?.estado : undefined;
        const total = blocos[indice].segundos;
        let contador = "0";
        let legenda = "";
        if (def && estado) {
          if (ehSustentacao(def)) {
            contador = relogio(estado.tempoValidoMs / 1000);
            if (def.formato === "respiracao") legenda = (agora / 1000) % 10 < 4 ? "Inspire pelo nariz" : "Solte o ar devagar";
            else if (!estado.naPosicao) legenda = "Entre na posição";
            else legenda = estado.lado ? `Lado ${estado.lado === "e" ? "esquerdo" : "direito"} · segure` : "Segure";
          } else {
            contador = String(estado.repsValidas);
            legenda = def.formato === "precisao" ? "acertos" : estado.repsParciais > 0 ? `${estado.repsParciais} parciais` : "repetições";
          }
        }
        setHud({
          etapa,
          indice,
          regressiva: Math.max(0, regressiva),
          contador,
          legenda,
          restanteS: Math.max(0, restanteMs / 1000),
          fracao: etapa === "ativo" ? 1 - Math.max(0, restanteMs) / (total * 1000) : 0,
          indicadores: chips,
          feedback: feedback && agora < feedback.ate ? feedback.texto : null,
          fora: estado?.foraDoQuadro ?? false,
          corpoVisivel,
          fps: Math.round(fps),
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

      detector = await criarDetector("lite");
      if (cancelado) return detector.landmarker.close();
      try {
        trava = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Sem Wake Lock: a tela pode apagar em desafios longos.
      }
      inicioJanela = performance.now();
      prepararBloco(0);
      raf = requestAnimationFrame(quadro);
    };

    iniciar().catch((falha: Error) => {
      if (!cancelado) semCamera(falha.message || "Não consegui abrir a câmera.");
    });

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      fecharCamera(stream);
      video.srcObject = null;
      calarVoz();
      try {
        detector?.landmarker.close();
      } catch {
        // Já estava fechado.
      }
      void trava?.release().catch(() => {});
    };
  }, [blocos]);

  const bloco = blocos[hud.indice] ?? blocos[0];
  const ativo = hud.etapa === "ativo";
  let situacao = "";
  if (hud.etapa === "carregando") situacao = "Abrindo a câmera e carregando o treinador…";
  else if (hud.etapa === "posicionar") {
    situacao = hud.corpoVisivel
      ? "Boa! Fique parado, já vai começar."
      : bloco.lateral
        ? "Fique de lado para o celular, com o corpo inteiro na tela."
        : "Fique de frente para o celular, com o corpo inteiro na tela.";
  } else if (hud.etapa === "contagem") situacao = "Prepare-se";
  else if (hud.etapa === "fim") situacao = "Feito!";
  else if (hud.fora) situacao = "Não estou te vendo. Volte para o quadro.";

  const raio = 92;
  const perimetro = 2 * Math.PI * raio;

  const relatarDor = async (regiao: string) => {
    setEnviandoDor(true);
    await registrarDor(id, bloco.exercicioId, regiao);
    router.push("/trilha");
  };

  return (
    <main className="fixed inset-0 z-10 overflow-hidden bg-black text-white">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />

      {/* Topo: exercício, posição no desafio e encerrar */}
      <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-10 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-lg font-black leading-tight">{bloco.exercicio}</p>
          <p className="text-sm text-white/75">
            {titulo} · Exercício {hud.indice + 1} de {blocos.length}
            {hud.fps > 0 && hud.fps < 12 ? " · câmera lenta" : ""}
          </p>
        </div>
        <button onClick={() => encerrarRef.current()} className="h-12 shrink-0 rounded-full bg-white/15 px-5 text-base font-bold backdrop-blur active:bg-white/25">
          Concluí
        </button>
      </header>

      {/* Centro: contador grande com o anel do tempo do exercício */}
      <div className="pointer-events-none absolute inset-x-0 top-[11%] flex flex-col items-center px-4 text-center">
        {hud.etapa === "contagem" ? (
          <p key={hud.regressiva} className="numero-camera pulso-rep text-[9rem] font-black leading-none">
            {hud.regressiva}
          </p>
        ) : ativo ? (
          <div className={`relative ${hud.fora ? "opacity-40" : ""}`}>
            <svg width="208" height="208" viewBox="0 0 208 208" aria-hidden>
              <circle cx="104" cy="104" r={raio} fill="rgb(0 0 0 / 0.45)" stroke="rgb(255 255 255 / 0.2)" strokeWidth="12" />
              <circle cx="104" cy="104" r={raio} fill="none" stroke="#FFC42E" strokeWidth="12" strokeLinecap="round" strokeDasharray={perimetro} strokeDashoffset={perimetro * hud.fracao} transform="rotate(-90 104 104)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p role="status" aria-live="polite" className={`numero-camera font-black leading-none ${hud.contador.length > 3 ? "text-[3.75rem]" : "text-[5.5rem]"}`}>
                {hud.contador}
              </p>
              <p className="numero-camera mt-1 max-w-[9.5rem] text-sm font-bold leading-tight text-white/85">{hud.legenda}</p>
            </div>
            <p role="timer" className="numero-camera mt-1 text-lg font-black tabular-nums" aria-label={`Faltam ${relogio(hud.restanteS)}`}>
              {relogio(Math.ceil(hud.restanteS))}
            </p>
          </div>
        ) : null}
      </div>

      {/* Faixa inferior: aviso de execução, situação, KPIs ao vivo e "Senti dor" */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        {hud.feedback && (
          <p role="alert" className="self-center rounded-2xl bg-ruim px-5 py-3 text-center text-2xl font-black text-black">
            {hud.feedback}
          </p>
        )}
        {situacao && (
          <p className={`numero-camera text-center text-xl font-bold ${hud.fora && ativo ? "text-ruim" : hud.corpoVisivel || ativo ? "text-white" : "text-atencao"}`}>
            {situacao}
          </p>
        )}
        {hud.etapa === "posicionar" && (
          <button onClick={() => comecarRef.current()} className="h-14 rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte">
            Começar agora
          </button>
        )}
        {ativo && hud.indicadores.length > 0 && (
          <dl className="grid auto-cols-fr grid-flow-col gap-2">
            {hud.indicadores.map((i) => (
              <div key={i.rotulo} className="rounded-xl bg-black/60 px-2 py-2 text-center">
                <dd className={`text-xl font-black tabular-nums ${i.bom ? "text-bom" : "text-atencao"}`}>{i.valor}</dd>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{i.rotulo}</dt>
              </div>
            ))}
          </dl>
        )}
        <button
          onClick={() => {
            pausadoRef.current = true;
            setDor(true);
          }}
          className="h-12 self-start rounded-full border border-white/30 bg-black/50 px-5 text-base font-bold backdrop-blur active:bg-white/15"
        >
          Senti dor
        </button>
      </div>

      {dor && (
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
            <button
              onClick={() => {
                pausadoRef.current = false;
                setDor(false);
              }}
              className="mt-4 h-14 w-full rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte"
            >
              Foi só um susto, continuar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

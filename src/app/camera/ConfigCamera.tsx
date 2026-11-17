"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { abrirCameraFrontal, fecharCamera } from "@/camera/camera";
import { desenharEsqueleto } from "@/camera/desenhar-esqueleto";
import { criarDetector, type Detector } from "@/camera/pose";
import { botaoPrimario, botaoSecundario, cartao } from "@/componentes/estilos";
import { VISIBILIDADE_MINIMA_PADRAO } from "@/motor/motor";
import { indicesDoPonto } from "@/motor/pontos";

type Etapa = "guia" | "abrindo" | "ao_vivo" | "negada";

/** Pontos que precisam aparecer para o enquadramento valer: da cabeça aos pés. */
const CORPO_INTEIRO = ["nariz", "ombro", "quadril", "joelho", "tornozelo"].flatMap(indicesDoPonto);
const VISIBILIDADE_MINIMA = VISIBILIDADE_MINIMA_PADRAO;

const DICAS = [
  "Apoie o celular em pé num móvel, na altura da cintura, ou encostado na parede.",
  "Fique a 2 ou 3 metros, num espaço livre de 2 x 2 metros.",
  "Piso que não escorrega e água por perto.",
];

export function ConfigCamera({ destino }: { destino: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [etapa, setEtapa] = useState<Etapa>("guia");
  const [enquadrado, setEnquadrado] = useState(false);
  const [mensagem, setMensagem] = useState("");

  // "abrindo" e "ao_vivo" usam a mesma câmera: o efeito não reinicia na troca entre eles.
  const cameraLigada = etapa === "abrindo" || etapa === "ao_vivo";

  useEffect(() => {
    if (!cameraLigada) return;
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let cancelado = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let detector: Detector | null = null;
    let ultimoTempo = -1;
    let bomDesde: number | null = null;
    let ultimoEstado = false;

    const quadro = () => {
      if (cancelado) return;
      raf = requestAnimationFrame(quadro);
      if (!detector || video.readyState < 2 || video.currentTime === ultimoTempo) return;
      ultimoTempo = video.currentTime;
      const agora = performance.now();
      let pontos = null;
      try {
        // Análise feita no aparelho; a imagem não sai daqui.
        pontos = detector.landmarker.detectForVideo(video, agora).landmarks[0] ?? null;
      } catch {
        return;
      }
      const visivel = !!pontos && CORPO_INTEIRO.every((i) => (pontos[i].visibility ?? 1) >= VISIBILIDADE_MINIMA);
      // Só fica verde depois de meio segundo estável, para não piscar.
      if (visivel) bomDesde ??= agora;
      else bomDesde = null;
      const bom = bomDesde !== null && agora - bomDesde >= 500;
      desenharEsqueleto(ctx, pontos, { valido: true, erro: false, cor: bom ? "#4ADE80" : "#FFC42E", visibilidadeMinima: VISIBILIDADE_MINIMA });
      if (bom !== ultimoEstado) {
        ultimoEstado = bom;
        setEnquadrado(bom);
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
      detector = await criarDetector("lite");
      if (cancelado) return detector.landmarker.close();
      setEtapa("ao_vivo");
      raf = requestAnimationFrame(quadro);
    };

    iniciar().catch((falha: Error) => {
      if (cancelado) return;
      setMensagem(falha.message);
      setEtapa("negada");
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
    };
  }, [cameraLigada]);

  if (etapa === "guia" || etapa === "negada") {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <ul className={`${cartao} flex flex-col gap-3`}>
          {DICAS.map((dica, i) => (
            <li key={dica} className="flex gap-3 text-[15px] leading-relaxed">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mel/15 text-sm font-black text-mel">
                {i + 1}
              </span>
              {dica}
            </li>
          ))}
        </ul>
        <p className="text-[15px] leading-relaxed text-apagado">
          O vídeo é analisado no seu aparelho. Nenhuma imagem é gravada ou enviada.
        </p>
        {etapa === "negada" && (
          <div role="alert" className={`${cartao} border-atencao/60`}>
            <p className="font-bold">Sem câmera por enquanto</p>
            <p className="mt-1 text-[15px] leading-relaxed text-apagado">
              {mensagem} Você pode seguir assim mesmo: no modo manual você confirma as repetições, ganha metade do XP e
              não pontua na liga.
            </p>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-3">
          <button onClick={() => setEtapa("abrindo")} className={botaoPrimario}>
            {etapa === "negada" ? "Tentar de novo" : "Permitir a câmera"}
          </button>
          {etapa === "negada" && (
            <Link href={destino} className={botaoSecundario}>
              Continuar sem câmera
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className={`relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-4 bg-black ${enquadrado ? "border-bom" : "border-borda"}`}>
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
        {etapa === "abrindo" && (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-base text-white/80">
            Abrindo a câmera…
          </p>
        )}
      </div>
      <p role="status" className={`text-center text-lg font-bold ${enquadrado ? "text-bom" : "text-texto"}`}>
        {etapa === "abrindo"
          ? "Só um instante"
          : enquadrado
            ? "Perfeito! Estou te vendo da cabeça aos pés."
            : "Afaste-se até aparecer o corpo inteiro."}
      </p>
      <Link href={destino} className={`${enquadrado ? botaoPrimario : botaoSecundario} mt-auto`}>
        Estou pronto
      </Link>
    </div>
  );
}

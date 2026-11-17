"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { botaoSecundario, cartao } from "@/componentes/estilos";

/**
 * Convite para colocar o Hive Break na tela inicial.
 * - Android/Chrome: botão que abre a janela de instalação do próprio sistema (1 toque).
 * - iPhone/iPad: a Apple não deixa instalar por botão, então mostramos os 2 toques no Safari.
 * - Navegador interno (Instagram, Facebook): pede para abrir no navegador de verdade.
 * Some quando o app já está instalado ou quando a pessoa fecha (volta depois de 7 dias).
 */

type Situacao = "servidor" | "instalado" | "dispensado" | "ios" | "android" | "interno" | "outro";

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CHAVE = "hive-break:instalar-fechado-em";
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

function lerSituacao(): Situacao {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone) return "instalado";
  try {
    const fechadoEm = Number(window.localStorage.getItem(CHAVE));
    if (fechadoEm && Date.now() - fechadoEm < SETE_DIAS) return "dispensado";
  } catch {
    // Sem acesso ao armazenamento: segue mostrando o convite.
  }
  const ua = nav.userAgent;
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(ua)) return "interno";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "outro";
}

const semAssinatura = () => () => {};

export function InstalarApp({ className = "" }: { className?: string }) {
  const situacao = useSyncExternalStore(semAssinatura, lerSituacao, (): Situacao => "servidor");
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [semJanela, setSemJanela] = useState(false);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const aoOferecer = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const aoInstalar = () => setFechado(true);
    window.addEventListener("beforeinstallprompt", aoOferecer);
    window.addEventListener("appinstalled", aoInstalar);
    // Se o navegador não oferecer a janela (Firefox, Samsung, já recusada), mostra o caminho manual.
    const espera = window.setTimeout(() => setSemJanela(true), 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoOferecer);
      window.removeEventListener("appinstalled", aoInstalar);
      window.clearTimeout(espera);
    };
  }, []);

  function fechar() {
    try {
      window.localStorage.setItem(CHAVE, String(Date.now()));
    } catch {
      // Ignora: fecha só nesta visita.
    }
    setFechado(true);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === "accepted") setFechado(true);
  }

  if (fechado || situacao === "servidor" || situacao === "instalado" || situacao === "dispensado") return null;
  if (situacao === "outro" && !evento) return null;
  if (situacao === "android" && !evento && !semJanela) return null;

  return (
    <section className={`${cartao} relative ${className}`} aria-label="Instalar o Hive Break">
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar"
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center text-xl text-apagado"
      >
        ×
      </button>
      <div className="flex items-center gap-3 pr-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icones/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div>
          <p className="text-base font-bold leading-tight">Tenha o Hive Break na tela inicial</p>
          <p className="mt-0.5 text-sm text-apagado">Abre em 1 toque, em tela cheia, como um app.</p>
        </div>
      </div>

      {situacao === "interno" ? (
        <p className="mt-4 text-[15px] leading-snug">
          Abra este link no navegador: toque em <strong>⋯</strong> no canto da tela e escolha{" "}
          <strong>Abrir no navegador</strong>. Lá você instala em 2 toques.
        </p>
      ) : situacao === "ios" ? (
        <ol className="mt-4 flex flex-col gap-2.5 text-[15px] leading-snug">
          <li className="flex items-center gap-3">
            <Passo n={1} />
            <span>
              Toque em <strong>Compartilhar</strong> <IconeCompartilhar /> na barra do Safari
            </span>
          </li>
          <li className="flex items-center gap-3">
            <Passo n={2} />
            <span>
              Escolha <strong>Adicionar à Tela de Início</strong> e depois <strong>Adicionar</strong>
            </span>
          </li>
        </ol>
      ) : evento ? (
        <button type="button" onClick={instalar} className={`${botaoSecundario} mt-4 border-mel text-mel`}>
          Instalar Hive Break
        </button>
      ) : (
        <p className="mt-4 text-[15px] leading-snug">
          Toque em <strong>⋮</strong> no canto do navegador e escolha <strong>Instalar app</strong> ou{" "}
          <strong>Adicionar à tela inicial</strong>.
        </p>
      )}
    </section>
  );
}

function Passo({ n }: { n: number }) {
  return (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-mel/15 text-sm font-black text-mel">
      {n}
    </span>
  );
}

function IconeCompartilhar() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="-mt-1 inline h-5 w-5 text-mel" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

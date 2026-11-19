"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * CAPTCHA invisível do Cloudflare Turnstile (docs/VISITANTE.md, seção 7).
 * O Supabase exige o token no login anônimo e no envio do código de login
 * quando a proteção está ligada em Authentication → Bot and Abuse Protection.
 *
 * Sem NEXT_PUBLIC_TURNSTILE_SITE_KEY o token é `undefined` e o Supabase aceita
 * enquanto a proteção estiver desligada no painel (desenvolvimento).
 */
const CHAVE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface ApiTurnstile {
  render(elemento: HTMLElement, opcoes: Record<string, unknown>): string;
  execute(widget: string): void;
  reset(widget: string): void;
  remove(widget: string): void;
}

declare global {
  interface Window {
    turnstile?: ApiTurnstile;
  }
}

let carregando: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  carregando ??= new Promise<void>((ok, falha) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => ok();
    script.onerror = () => {
      carregando = null;
      falha(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return carregando;
}

type Pendente = { ok: (token: string) => void; falha: (erro: Error) => void };

export function useTurnstile() {
  const caixa = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const pendente = useRef<Pendente | null>(null);

  useEffect(() => {
    if (!CHAVE) return;
    let vivo = true;
    carregarScript()
      .then(() => {
        if (!vivo || !caixa.current || !window.turnstile) return;
        widget.current = window.turnstile.render(caixa.current, {
          sitekey: CHAVE,
          execution: "execute",
          appearance: "interaction-only",
          language: "pt-br",
          callback: (token: string) => {
            pendente.current?.ok(token);
            pendente.current = null;
          },
          "error-callback": () => {
            pendente.current?.falha(new Error("captcha"));
            pendente.current = null;
          },
        });
      })
      .catch(() => {});
    return () => {
      vivo = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  /** Token novo a cada chamada (o Supabase aceita cada um uma vez só). */
  const pegarToken = useCallback(async (): Promise<string | undefined> => {
    if (!CHAVE) return undefined;
    await carregarScript();
    for (let i = 0; i < 50 && !widget.current; i++) await new Promise((r) => setTimeout(r, 100));
    const id = widget.current;
    if (!id || !window.turnstile) throw new Error("captcha");
    return new Promise<string>((ok, falha) => {
      pendente.current = { ok, falha };
      window.turnstile!.reset(id);
      window.turnstile!.execute(id);
    });
  }, []);

  return { pegarToken, caixa };
}

/** Lugar do widget: só aparece se o Cloudflare pedir uma interação. */
export function CaixaTurnstile({ caixa }: { caixa: React.RefObject<HTMLDivElement | null> }) {
  return <div ref={caixa} className="flex justify-center empty:hidden" />;
}

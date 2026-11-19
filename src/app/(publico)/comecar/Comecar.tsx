"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { DeclaracaoSaude } from "@/componentes/DeclaracaoSaude";
import { botaoPrimario, campoTexto } from "@/componentes/estilos";
import { CaixaTurnstile, useTurnstile } from "@/componentes/Turnstile";
import { MENSAGENS_CODIGO } from "@/dominio/codigo-email";
import { erroDeFormato, normalizarUsername, USERNAME_MAX } from "@/dominio/username";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { iniciarVisitante, verificarUsername, type Disponibilidade } from "./acoes";

type Checagem = Disponibilidade & { nome: string };

function erroAnonimo(e: { code?: string; message: string; status?: number }): string {
  if (e.code === "anonymous_provider_disabled" || /anonymous sign-ins are disabled/i.test(e.message))
    return "O acesso de visitante ainda não foi ligado. Tente entrar com o Google.";
  if (e.code === "captcha_failed" || /captcha/i.test(e.message)) return MENSAGENS_CODIGO.captcha;
  if (e.status === 429 || e.code === "over_request_rate_limit")
    return "Muita gente entrando ao mesmo tempo daqui. Tente de novo em alguns minutos.";
  return "Não consegui começar agora. Confira a internet e tente de novo.";
}

/**
 * Passo 2 (docs/VISITANTE.md, seção 1): username com checagem ao digitar,
 * "Tenho 18 anos ou mais e aceito os termos" e a declaração de saúde em dois
 * pop-ups. Só depois de confirmar tudo cria a sessão de visitante.
 */
export function Comecar({ jaVisitante, volta }: { jaVisitante: boolean; volta: string | null }) {
  const [nome, setNome] = useState("");
  const [checagem, setChecagem] = useState<Checagem | null>(null);
  const [aceite, setAceite] = useState(false);
  const [declarando, setDeclarando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const { pegarToken, caixa } = useTurnstile();
  const ultimo = useRef("");

  const normal = normalizarUsername(nome);
  const formato = nome ? erroDeFormato(nome) : null;

  // Disponibilidade com um pequeno atraso enquanto a pessoa digita.
  useEffect(() => {
    if (!normal || formato) return;
    ultimo.current = normal;
    const t = setTimeout(async () => {
      const r = await verificarUsername(normal).catch(() => null);
      if (r && ultimo.current === normal) setChecagem({ ...r, nome: normal });
    }, 350);
    return () => clearTimeout(t);
  }, [normal, formato]);

  const atual = checagem?.nome === normal ? checagem : null;
  const disponivel = !formato && atual?.ok === true;

  const continuar = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!disponivel) return;
    if (!aceite) {
      setErro("Para continuar, confirme que tem 18 anos ou mais e aceita os termos.");
      return;
    }
    setDeclarando(true);
  };

  const confirmar = (todasNao: boolean) => {
    setErro(null);
    iniciar(async () => {
      if (!jaVisitante) {
        let captchaToken: string | undefined;
        try {
          captchaToken = await pegarToken();
        } catch {
          setErro(MENSAGENS_CODIGO.captcha);
          return;
        }
        const supabase = criarClienteNavegador();
        const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
        if (error) {
          setErro(erroAnonimo(error));
          return;
        }
      }
      const r = await iniciarVisitante(normal, todasNao, volta);
      if (r.ok && r.destino) {
        window.location.assign(r.destino);
        return;
      }
      if (r.username) {
        setDeclarando(false);
        setChecagem({ ...r.username, nome: normal });
        return;
      }
      setErro(r.erro ?? "Não consegui começar agora. Tente de novo.");
    });
  };

  return (
    <form onSubmit={continuar} className="flex flex-1 flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-apagado">Seu username</span>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-apagado">@</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value.replace(/\s/g, "").toLowerCase())}
            maxLength={USERNAME_MAX}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="joana.silva"
            aria-describedby="username-status"
            aria-invalid={Boolean(formato || (atual && !atual.ok)) || undefined}
            className={`${campoTexto} pl-10`}
          />
        </div>
      </label>
      <div id="username-status" aria-live="polite" className="-mt-2 min-h-6 text-[15px]">
        {!nome ? (
          <span className="text-apagado">Letras, números, ponto e sublinhado. De 3 a 20.</span>
        ) : formato ? (
          <span className="text-atencao">{formato}</span>
        ) : !atual ? (
          <span className="text-apagado">Conferindo…</span>
        ) : atual.ok ? (
          <span className="font-semibold text-bom">@{normal} está livre ✓</span>
        ) : (
          <span className="text-atencao">{atual.mensagem}</span>
        )}
      </div>
      {atual && !atual.ok && atual.sugestoes.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-2">
          <span className="w-full text-sm text-apagado">Que tal:</span>
          {atual.sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setNome(s)}
              className="h-10 rounded-full border border-borda bg-superficie px-4 text-[15px] font-bold active:bg-superficie-2"
            >
              @{s}
            </button>
          ))}
        </div>
      )}

      <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-2xl border border-borda bg-superficie p-4 has-[:checked]:border-mel">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-mel)]" />
        <span className="text-[15px] leading-snug">
          Tenho 18 anos ou mais e aceito os{" "}
          <Link href="/termos" target="_blank" className="font-bold text-mel underline underline-offset-4">termos de uso e a política de privacidade</Link>,
          incluindo o uso dos meus dados de saúde para cuidar da minha segurança.
        </span>
      </label>

      {erro && !declarando && <p role="alert" className="rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">{erro}</p>}
      <CaixaTurnstile caixa={caixa} />

      <button type="submit" disabled={!disponivel || ocupado} className={`${botaoPrimario} mt-auto`}>
        Continuar
      </button>

      <DeclaracaoSaude
        aberto={declarando}
        aoFechar={() => setDeclarando(false)}
        aoConfirmar={confirmar}
        ocupado={ocupado}
        erro={declarando ? erro : null}
      />
    </form>
  );
}

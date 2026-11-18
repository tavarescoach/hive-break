"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { enviarCodigo, verificarCodigo } from "@/app/codigo/acoes";
import { CampoCodigo } from "@/componentes/CampoCodigo";
import { botaoPrimario, botaoSecundario, campoTexto } from "@/componentes/estilos";
import { CaixaTurnstile, useTurnstile } from "@/componentes/Turnstile";
import { codigoCompleto, emailValido, MENSAGENS_CODIGO, REENVIO_S, type FluxoCodigo as Fluxo } from "@/dominio/codigo-email";

/**
 * E-mail → código de 6 dígitos (docs/VISITANTE.md, seção 6). Sem senha.
 * Usado em "Salvar meu resultado" (conversao) e em "Entrar" (login).
 */
export function FluxoCodigo({ fluxoInicial, botao, aviso }: { fluxoInicial: "conversao" | "login"; botao: string; aviso?: string }) {
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [fluxo, setFluxo] = useState<Fluxo>(fluxoInicial);
  const [codigo, setCodigo] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semConta, setSemConta] = useState(false);
  const [podeReenviarEm, setPodeReenviarEm] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [precisaNovo, setPrecisaNovo] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const { pegarToken, caixa } = useTurnstile();

  // Contagem do reenvio (60 s).
  useEffect(() => {
    if (podeReenviarEm <= agora) return;
    const t = setTimeout(() => setAgora(Date.now()), 500);
    return () => clearTimeout(t);
  }, [podeReenviarEm, agora]);
  const faltaS = Math.max(0, Math.ceil((podeReenviarEm - agora) / 1000));

  const enviar = () => {
    setErro(null);
    setSemConta(false);
    if (!emailValido(email)) {
      setErro(MENSAGENS_CODIGO.emailInvalido);
      return;
    }
    iniciar(async () => {
      let captcha: string | undefined;
      try {
        captcha = await pegarToken();
      } catch {
        setErro(MENSAGENS_CODIGO.captcha);
        return;
      }
      const r = await enviarCodigo(fluxoInicial, email, captcha);
      if (r.esperaS) {
        setPodeReenviarEm(Date.now() + r.esperaS * 1000);
        setAgora(Date.now());
      }
      if (!r.ok) {
        setErro(r.erro ?? MENSAGENS_CODIGO.falha);
        setSemConta(Boolean(r.semConta));
        return;
      }
      setFluxo(r.fluxo ?? fluxoInicial);
      setCodigo("");
      setPrecisaNovo(false);
      setEtapa("codigo");
      setMensagem(
        r.fluxo === "migracao"
          ? `Esse e-mail já tem conta. ${MENSAGENS_CODIGO.enviado(email.trim())} Depois de entrar, seu resultado vai para ela.`
          : MENSAGENS_CODIGO.enviado(email.trim()),
      );
    });
  };

  const verificar = (valor: string) => {
    if (!codigoCompleto(valor) || ocupado) return;
    setErro(null);
    iniciar(async () => {
      const r = await verificarCodigo(fluxo, email, valor);
      if (r.ok) {
        // Recarrega de verdade: a sessão nova está nos cookies.
        window.location.assign(r.destino ?? "/onboarding");
        return;
      }
      setErro(r.erro ?? MENSAGENS_CODIGO.falha);
      setCodigo("");
      setPrecisaNovo(r.tipoErro === "bloqueado" || r.tipoErro === "expirado");
    });
  };

  if (etapa === "email") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-apagado">Seu e-mail</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@gmail.com"
            aria-invalid={Boolean(erro) || undefined}
            className={campoTexto}
          />
        </label>
        {aviso && <p className="text-[14px] leading-relaxed text-apagado">{aviso}</p>}
        {erro && (
          <p role="alert" className="rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">
            {erro}
            {semConta && (
              <>
                {" "}
                <Link href="/comecar" className="font-bold text-mel underline underline-offset-4">Começar agora</Link>
              </>
            )}
          </p>
        )}
        <CaixaTurnstile caixa={caixa} />
        <button type="submit" disabled={ocupado || faltaS > 0} className={botaoPrimario}>
          {ocupado ? "Enviando…" : faltaS > 0 ? `Aguarde ${faltaS} s` : botao}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {mensagem && <p role="status" className="text-[15px] leading-relaxed">{mensagem}</p>}
      <CampoCodigo valor={codigo} aoMudar={setCodigo} aoCompletar={verificar} desativado={ocupado || precisaNovo} erro={Boolean(erro)} />
      {erro && <p role="alert" className="rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">{erro}</p>}
      <CaixaTurnstile caixa={caixa} />
      {precisaNovo ? (
        <button onClick={enviar} disabled={ocupado || faltaS > 0} className={botaoPrimario}>
          {faltaS > 0 ? `Mandar outro em ${faltaS} s` : "Mandar outro código"}
        </button>
      ) : (
        <button onClick={() => verificar(codigo)} disabled={ocupado || !codigoCompleto(codigo)} className={botaoPrimario}>
          {ocupado ? "Conferindo…" : "Confirmar"}
        </button>
      )}
      <div className="flex items-center justify-between gap-3 text-[15px]">
        <button
          onClick={() => {
            setEtapa("email");
            setErro(null);
            setMensagem(null);
          }}
          className="h-12 font-semibold text-apagado underline underline-offset-4"
        >
          Trocar e-mail
        </button>
        {!precisaNovo && (
          <button onClick={enviar} disabled={ocupado || faltaS > 0} className="h-12 font-semibold text-mel underline underline-offset-4 disabled:text-apagado disabled:no-underline">
            {faltaS > 0 ? `Reenviar em ${faltaS} s` : "Reenviar código"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Botão secundário menor, para a alternativa "Entrar com Google". */
export const botaoAlternativo = `${botaoSecundario} h-12 text-base`;

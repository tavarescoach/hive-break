"use client";

import { useState } from "react";
import { prepararMigracaoGoogle } from "@/app/codigo/acoes";
import { criarClienteNavegador } from "@/lib/supabase/navegador";

/**
 * Login com Google, a alternativa ao código por e-mail (docs/VISITANTE.md).
 * modo "visitante": vincula o Google ao usuário anônimo (manual identity
 * linking), mantendo username e resultado. Se essa conta Google já existir, a
 * volta do login leva o resultado para ela (cookie de migração).
 */
export function BotaoGoogle({ modo = "login", pequeno = false }: { modo?: "login" | "visitante"; pequeno?: boolean }) {
  const [estado, setEstado] = useState<"parado" | "abrindo" | "erro">("parado");

  const entrar = async () => {
    setEstado("abrindo");
    const supabase = criarClienteNavegador();
    const redirectTo = `${window.location.origin}/auth/callback`;
    if (modo === "visitante") {
      await prepararMigracaoGoogle().catch(() => false);
      const vinculo = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } });
      if (!vinculo.error) return;
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setEstado("erro");
  };

  return (
    <>
      <button
        onClick={entrar}
        disabled={estado === "abrindo"}
        className={
          pequeno
            ? "flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-borda px-5 text-base font-bold text-texto active:bg-superficie disabled:opacity-60"
            : "flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 text-lg font-bold text-black active:bg-white/85 disabled:opacity-60"
        }
      >
        <svg width={pequeno ? 18 : 22} height={pequeno ? 18 : 22} viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.500-4.800 7.200l7.700 6c4.500-4.200 6.900-10.300 6.900-17.700z" />
          <path fill="#FBBC05" d="M10.500 28.600c-.500-1.500-.800-3-.800-4.600s.300-3.100.800-4.600l-7.900-6.200C1 16.500 0 20.100 0 24s1 7.500 2.600 10.800l7.900-6.200z" />
          <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.100 1.400-4.900 2.300-8.200 2.300-6.300 0-11.600-4.100-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z" />
        </svg>
        {estado === "abrindo" ? "Abrindo o Google…" : "Entrar com Google"}
      </button>
      {estado === "erro" && (
        <p role="alert" className="text-center text-[15px] text-ruim">
          Não consegui abrir o login do Google. Confira a internet e tente de novo.
        </p>
      )}
    </>
  );
}

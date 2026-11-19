"use client";

import Link from "next/link";
import { useRef } from "react";
import { botaoSecundario } from "@/componentes/estilos";
import type { ResultadoBusca } from "@/dominio/busca";
import { BuscaAmigos } from "./buscar/BuscaAmigos";

/**
 * "🔍 Buscar amigos" (docs/PERFIL.md, seção 3.4): no celular vai para
 * /amigos/buscar; no computador (≥1024px) abre num modal, sem sair da tela.
 */
export function ModalBuscarAmigos({ sugestoes }: { sugestoes: ResultadoBusca[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Link href="/amigos/buscar" className={`${botaoSecundario} lg:hidden`}>
        🔍 Buscar amigos
      </Link>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={`${botaoSecundario} hidden lg:flex`}>
        🔍 Buscar amigos
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border border-borda bg-fundo p-5 text-texto backdrop:bg-black/70"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Buscar amigos</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Fechar" className="text-xl text-apagado">
            ✕
          </button>
        </div>
        <BuscaAmigos sugestoesIniciais={sugestoes} />
      </dialog>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRef } from "react";
import { Avatar } from "@/componentes/Avatar";
import { cartao } from "@/componentes/estilos";

export interface ConvidadoResumo {
  id: string;
  nome: string;
  username: string | null;
  avatarUrl: string | null;
  situacao: "fez_desafio" | "cadastro_pronto" | "cadastrando";
}

const ROTULO_SITUACAO: Record<ConvidadoResumo["situacao"], string> = {
  fez_desafio: "Fez o 1º desafio",
  cadastro_pronto: "Cadastro pronto, falta o 1º desafio",
  cadastrando: "Ainda terminando o cadastro",
};

/**
 * "Seus convites" (docs/PERFIL.md, seção 4): 1 linha com o resumo, que abre a
 * lista completa num modal. Quem já fez o 1º desafio também é seguidor
 * automático (ativar_convite), então o perfil de cada um já é inspecionável.
 */
export function ModalConvites({ convidados, ativados }: { convidados: ConvidadoResumo[]; ativados: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (convidados.length === 0) {
    return (
      <p className="text-[15px] leading-relaxed text-apagado">
        Ninguém entrou pelo seu link ainda. Mande para quem você quer ver treinando.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={`${cartao} flex w-full items-center justify-between gap-3 text-left`}
      >
        <div>
          <p className="font-bold">Seus convites</p>
          <p className="text-sm text-apagado">
            {convidados.length} {convidados.length === 1 ? "pessoa entrou" : "pessoas entraram"} · {ativados}{" "}
            {ativados === 1 ? "já fez" : "já fizeram"} o 1º desafio
          </p>
        </div>
        <span aria-hidden className="text-apagado">
          ›
        </span>
      </button>

      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border border-borda bg-fundo p-5 text-texto backdrop:bg-black/70"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Seus convites</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Fechar" className="text-xl text-apagado">
            ✕
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {convidados.map((c) => {
            const conteudo = (
              <>
                <Avatar url={c.avatarUrl} nome={c.nome} tamanho={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.nome}</p>
                  <p className="text-sm text-apagado">{ROTULO_SITUACAO[c.situacao]}</p>
                </div>
              </>
            );
            return (
              <li key={c.id} className={`${cartao} flex items-center gap-3 py-3`}>
                {c.username ? (
                  <Link href={`/@${c.username}`} className="flex min-w-0 flex-1 items-center gap-3" onClick={() => dialogRef.current?.close()}>
                    {conteudo}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      </dialog>
    </>
  );
}

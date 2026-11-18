"use client";

import { useEffect, useState } from "react";
import { type CandidatoResgate, listarAmigosSumidos } from "@/app/resgate/acoes";
import { FolhaResgate } from "@/app/resgate/FolhaResgate";
import { Avatar } from "@/componentes/Avatar";
import { cartao, sobrelinha } from "@/componentes/estilos";

/**
 * Faixa "N amigos sumidos. Chamar?" (docs/RESGATE.md, seção 3): os amigos
 * elegíveis para resgate que não cabem no pop-up do dia.
 */
export function FaixaAmigosSumidos() {
  const [lista, setLista] = useState<CandidatoResgate[] | null>(null);
  const [aberta, setAberta] = useState(false);
  const [chamando, setChamando] = useState<CandidatoResgate | null>(null);

  useEffect(() => {
    let vivo = true;
    listarAmigosSumidos()
      .then((l) => vivo && setLista(l))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (chamando) {
    return (
      <FolhaResgate
        amigoId={chamando.amigoId}
        apelido={chamando.apelido}
        appDisponivel={chamando.appDisponivel}
        aoFechar={() => setChamando(null)}
        aoEnviado={() => {
          setLista((l) => l?.filter((c) => c.amigoId !== chamando.amigoId) ?? l);
          setChamando(null);
        }}
      />
    );
  }

  if (!lista || lista.length === 0) return null;

  return (
    <section className={`${cartao} border-mel/40`}>
      <button onClick={() => setAberta((a) => !a)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className={sobrelinha}>Amigos sumidos</p>
          <p className="mt-1 text-base font-bold">
            {lista.length} {lista.length === 1 ? "amigo sumido" : "amigos sumidos"}. Chamar?
          </p>
        </div>
        <svg
          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden className={`shrink-0 transition-transform ${aberta ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {aberta && (
        <ul className="mt-3 flex flex-col gap-2">
          {lista.map((c) => (
            <li key={c.amigoId} className="flex items-center gap-3">
              <Avatar url={c.avatarUrl} nome={c.apelido} tamanho={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{c.apelido}</p>
                <p className="text-sm text-apagado">{c.dias} {c.dias === 1 ? "dia" : "dias"} sem break</p>
              </div>
              <button
                onClick={() => setChamando(c)}
                className="shrink-0 rounded-full bg-mel px-4 py-2 text-sm font-black text-black active:bg-mel-forte"
              >
                Chamar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

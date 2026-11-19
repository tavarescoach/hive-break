"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/componentes/Avatar";
import { BotaoSeguir } from "@/componentes/BotaoSeguir";
import { cartao } from "@/componentes/estilos";

export interface PessoaRede {
  id: string;
  apelido: string | null;
  username: string | null;
  avatar_url: string | null;
  xp_semana: number;
  em_hive_agora: boolean;
  seguindo: boolean;
  segue_voce: boolean;
}

/** Abas Seguindo | Seguidores, ordenadas por XP da semana (docs/PERFIL.md, seção 3.4). */
export function ListaRede({ seguindo, seguidores }: { seguindo: PessoaRede[]; seguidores: PessoaRede[] }) {
  const [aba, setAba] = useState<"seguindo" | "seguidores">("seguindo");
  const lista = aba === "seguindo" ? seguindo : seguidores;

  return (
    <section className={`${cartao} flex flex-col gap-3`}>
      <div className="flex gap-4 border-b border-borda">
        {(["seguindo", "seguidores"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`-mb-px border-b-2 pb-2 text-sm font-bold capitalize ${aba === a ? "border-mel text-texto" : "border-transparent text-apagado"}`}
          >
            {a} · {a === "seguindo" ? seguindo.length : seguidores.length}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-apagado">{aba === "seguindo" ? "Você ainda não segue ninguém." : "Ninguém te segue ainda."}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {lista.map((p) => {
            const nome = p.apelido ?? p.username ?? "Hiver";
            const conteudo = (
              <>
                <span className={`relative rounded-full ${p.em_hive_agora ? "ring-2 ring-mel" : ""}`}>
                  <Avatar url={p.avatar_url} nome={nome} tamanho={36} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{nome}</p>
                  <p className="text-xs text-apagado">{p.xp_semana} XP esta semana</p>
                </div>
              </>
            );
            return (
              <li key={p.id} className="flex items-center gap-3">
                {p.username ? (
                  <Link href={`/@${p.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                    {conteudo}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-3">{conteudo}</div>
                )}
                {!p.seguindo && <BotaoSeguir alvoId={p.id} inicial={p} compacto />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

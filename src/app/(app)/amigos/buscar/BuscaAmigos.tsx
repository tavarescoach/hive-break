"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/componentes/Avatar";
import { BotaoSeguir } from "@/componentes/BotaoSeguir";
import { cartao } from "@/componentes/estilos";
import { BUSCA_DEBOUNCE_MS, BUSCA_MIN_CARACTERES, type ResultadoBusca } from "@/dominio/busca";
import { CORES_DIVISAO, NOMES_DIVISAO, type Divisao } from "@/dominio/liga";
import { OBJETIVOS, rotuloDe } from "@/dominio/perfil";
import { buscarUsuarios } from "./acoes";

/** Campo de busca + resultados (docs/PERFIL.md, seção 4.2). */
export function BuscaAmigos({ sugestoesIniciais }: { sugestoesIniciais: ResultadoBusca[] }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const termo = q.trim();
    const curta = termo.length < BUSCA_MIN_CARACTERES;
    const id = setTimeout(
      () => {
        if (curta) {
          setResultados(null);
          setErro("");
          setCarregando(false);
          return;
        }
        setCarregando(true);
        buscarUsuarios(termo).then((r) => {
          setCarregando(false);
          if (r.ok) {
            setResultados(r.resultados);
            setErro("");
          } else {
            setErro(r.erro);
          }
        });
      },
      curta ? 0 : BUSCA_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [q]);

  const mostrandoSugestoes = resultados === null;
  const lista = mostrandoSugestoes ? sugestoesIniciais : resultados;

  return (
    <div className="flex flex-col gap-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou @username"
        className="h-14 w-full rounded-xl border border-borda bg-superficie px-4 text-lg font-semibold text-texto placeholder:text-apagado/60"
      />
      {erro && (
        <p role="alert" className="text-sm text-apagado">
          {erro}
        </p>
      )}
      {mostrandoSugestoes && lista.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-apagado">Sugestões para você</p>}
      {!carregando && !mostrandoSugestoes && lista.length === 0 && (
        <p className="text-[15px] leading-relaxed text-apagado">Ninguém com esse nome por aqui ainda. Treinar é mais fácil com a sua hive.</p>
      )}
      <ul className="flex flex-col gap-2">
        {lista.map((r) => (
          <LinhaResultado key={r.id} r={r} />
        ))}
      </ul>
    </div>
  );
}

function LinhaResultado({ r }: { r: ResultadoBusca }) {
  const divisao = r.divisao_atual as Divisao;
  const cor = CORES_DIVISAO[divisao] ?? CORES_DIVISAO.bronze;
  const nome = r.apelido ?? r.username ?? "Hiver";
  const conteudo = (
    <>
      <Avatar url={r.avatar_url} nome={nome} tamanho={44} />
      <div className="min-w-0">
        <p className="truncate font-bold">{nome}</p>
        <p className="truncate text-sm text-apagado">
          {r.username && `@${r.username} · `}🔥 {r.ofensiva} · <span style={{ color: cor }}>{NOMES_DIVISAO[divisao] ?? NOMES_DIVISAO.bronze}</span>
          {r.objetivo && ` · ${rotuloDe(OBJETIVOS, r.objetivo)}`}
        </p>
        {r.amigos_em_comum > 0 && (
          <p className="text-xs text-apagado">
            {r.amigos_em_comum} {r.amigos_em_comum === 1 ? "amigo em comum" : "amigos em comum"}
          </p>
        )}
      </div>
    </>
  );
  return (
    <li className={`${cartao} flex items-center gap-3 py-3`}>
      {r.username ? (
        <Link href={`/@${r.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          {conteudo}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{conteudo}</div>
      )}
      <BotaoSeguir alvoId={r.id} inicial={r} compacto />
    </li>
  );
}

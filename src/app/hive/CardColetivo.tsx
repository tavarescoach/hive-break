"use client";

import { useEffect, useState } from "react";
import { cartao } from "@/componentes/estilos";
import { ordenarResultado, textoConviteHive, type DadosHive } from "@/dominio/hive";
import { lerHive } from "./acoes";
import { Hexagono } from "./AoVivo";

/**
 * Card de resultado coletivo: cada participante com reps, tempo e XP. Fica
 * atualizando enquanto alguém ainda está fazendo (quem entrou atrasado também).
 */
export function CardColetivo({ hiveId, euId, inicial }: { hiveId: string; euId: string; inicial?: DadosHive | null }) {
  const [hive, setHive] = useState<DadosHive | null>(inicial ?? null);

  useEffect(() => {
    let ativo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const ler = async (rodada: number) => {
      const dados = await lerHive(hiveId);
      if (!ativo) return;
      if (dados) setHive(dados);
      const faltaAlguem = dados ? dados.participantes.some((p) => !p.concluido) && dados.status !== "encerrada" : true;
      // Atualiza a cada 4 s por até 20 min.
      if (faltaAlguem && rodada < 300) espera = setTimeout(() => void ler(rodada + 1), 4000);
    };
    void ler(0);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [hiveId]);

  if (!hive) return null;
  const lista = ordenarResultado(hive.participantes, hive.modo_competicao);
  const faltam = hive.participantes.filter((p) => !p.concluido).length;
  const compartilhar = async () => {
    const link = `${window.location.origin}/hive/${hive.id}`;
    const texto = textoConviteHive(hive, link);
    if (navigator.share) {
      await navigator.share({ text: texto }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    }
  };

  return (
    <section className={cartao} aria-label="Resultado da hive">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-black leading-tight">Sua hive</h2>
        <p className="text-sm font-semibold text-apagado">
          {faltam > 0 ? `${faltam} ainda fazendo…` : `${lista.length} ${lista.length === 1 ? "pessoa" : "pessoas"}`}
        </p>
      </div>
      <p className="text-sm text-apagado">{hive.desafio}{hive.modo_competicao ? " · modo competição" : ""}</p>
      <ol className="mt-3 flex flex-col divide-y divide-borda">
        {lista.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            {hive.modo_competicao && <span className="w-5 text-center font-black tabular-nums text-apagado">{p.concluido ? i + 1 : ""}</span>}
            <Hexagono nome={p.apelido} url={p.avatar_url} tamanho={32} destaque={p.id === euId} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{p.id === euId ? "Você" : p.apelido}</span>
              <span className="block text-[13px] text-apagado">
                {p.atrasado ? "entrou depois" : "desde o começo"}
                {p.modo === "manual" ? " · sem câmera" : ""}
              </span>
            </span>
            {p.concluido ? (
              <span className="shrink-0 text-right">
                <span className="block font-black tabular-nums">
                  {(p.reps ?? 0) > 0 ? `${p.reps} reps` : (p.tempo_valido_s ?? 0) > 0 ? `${Math.round(Number(p.tempo_valido_s))} s` : "feito"}
                </span>
                <span className="block text-[13px] font-semibold tabular-nums text-mel">+{p.xp ?? 0} XP</span>
              </span>
            ) : (
              <span className="shrink-0 text-sm font-semibold text-apagado">fazendo…</span>
            )}
          </li>
        ))}
      </ol>
      <button onClick={compartilhar} className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-[#25D366] text-base font-black text-[#0B3A1E] active:opacity-90">
        Chamar mais gente no WhatsApp
      </button>
    </section>
  );
}

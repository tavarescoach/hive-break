"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { criarHive } from "@/app/hive/acoes";
import { botaoPrimario, botaoSecundario } from "@/componentes/estilos";
import { hiveParaJogar, type TrilhaAcessoriaMontada } from "@/dominio/trilhaAcessoria";
import { HexagonoAcessorio } from "./HexagonoAcessorio";

function IconeCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFC42E" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Bottom sheet da trilha acessória (seção 4 do pedido): dados da trilha, exercícios, progresso e as ações. */
export function PopupTrilhaAcessoria({ trilha, aoFechar }: { trilha: TrilhaAcessoriaMontada; aoFechar: () => void }) {
  const router = useRouter();
  const [semImpacto, setSemImpacto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [chamando, iniciar] = useTransition();

  const proxima = trilha.proxima;
  const travada = proxima?.estado === "travado";
  // Já fez todas: "Rever" reabre a primeira hive.
  const hiveBase = proxima ?? trilha.hives[0];
  const hiveAlvo = hiveBase ? hiveParaJogar(trilha, hiveBase.id, semImpacto) : null;
  const ctaTexto = !proxima ? "Rever hives" : trilha.progresso > 0 ? `Let's hive · hive ${trilha.progresso + 1}` : "Let's hive";
  const progressoTexto = trilha.progresso > 0 ? `${trilha.progresso} de ${trilha.total} hives` : "Comece pela hive 1";
  const pct = trilha.total ? Math.round((trilha.progresso / trilha.total) * 100) : 0;

  const chamarHive = () => {
    if (!hiveAlvo) return;
    setErro(null);
    iniciar(async () => {
      const r = await criarHive(hiveAlvo, false);
      if (!r.ok || !r.id) {
        setErro(r.erro ?? "Não consegui abrir a sala.");
        return;
      }
      router.push(`/hive/${r.id}`);
    });
  };

  return (
    <>
      <button onClick={aoFechar} aria-label="Fechar" className="fixed inset-0 z-40 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={trilha.nome}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92%] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-t-[28px] border-t border-borda bg-superficie px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5"
      >
        <div className="flex justify-center">
          <span aria-hidden className="h-[5px] w-10 rounded-full bg-borda" />
        </div>

        <div className="flex items-center gap-3.5">
          <span className="block w-[52px] flex-none">
            <HexagonoAcessorio trilha={trilha.id} cor={trilha.cor} corSombra={trilha.corSombra} tamanho={52} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-apagado">Trilha acessória</p>
            <h2 className="truncate text-xl font-black leading-tight">{trilha.nome}</h2>
          </div>
          <button onClick={aoFechar} aria-label="Fechar" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-superficie-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <p className="text-[15px] leading-relaxed">{trilha.frase}</p>

        <div className="grid grid-cols-4 gap-2">
          <div className="flex flex-col gap-1 rounded-xl bg-fundo px-2 py-2.5">
            <span className="text-[11px] font-semibold text-apagado">Hives</span>
            <span className="text-lg font-black tabular-nums">{trilha.total}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-fundo px-2 py-2.5">
            <span className="text-[11px] font-semibold text-apagado">Por hive</span>
            <span className="text-lg font-black tabular-nums">{trilha.tempoPorHive}</span>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-fundo px-2 py-2.5">
            <span className="text-[11px] font-semibold text-apagado">Intensidade</span>
            <div role="img" aria-label={trilha.intensidadeLabel} className="flex h-4 items-end gap-[3px]">
              {[10, 13, 16].map((altura, i) => (
                <span key={i} className="w-2 rounded-sm" style={{ height: altura, background: i < trilha.barras ? "#FFC42E" : "#3A3C42" }} />
              ))}
            </div>
            <span className="text-[11px] font-bold">{trilha.intensidadeLabel}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-fundo px-2 py-2.5">
            <span className="text-[11px] font-semibold text-apagado">Material</span>
            <span className="text-[14px] font-black leading-tight">{trilha.material}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {trilha.material === "Nenhum" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fundo px-2.5 py-1.5 text-[13px] font-bold text-texto">
              <Check />
              Dá pra fazer sem nada
            </span>
          ) : (
            <span className="rounded-full bg-fundo px-2.5 py-1.5 text-[13px] font-bold text-texto">{trilha.material}</span>
          )}
          {trilha.opcional && <span className="text-[13px] text-apagado">{trilha.opcional}</span>}
        </div>

        {trilha.semImpacto && (
          <button
            onClick={() => setSemImpacto((v) => !v)}
            role="switch"
            aria-checked={semImpacto}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 border-borda bg-fundo px-3.5 py-2.5 text-left"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold">Versão sem impacto</span>
              <span className="text-[13px] text-apagado">{semImpacto ? "Ligada: sem salto, ritmo forte do mesmo jeito" : "Desligada: inclui saltos"}</span>
            </span>
            <span className="block h-7 w-12 flex-none rounded-full" style={{ background: semImpacto ? "#FFC42E" : "#3A3C42" }}>
              <span
                className="block h-[22px] w-[22px] rounded-full bg-fundo"
                style={{ marginTop: 3, marginLeft: semImpacto ? 23 : 3, transition: "margin-left 150ms" }}
              />
            </span>
          </button>
        )}

        <div className="flex flex-col gap-2.5">
          <h3 className="text-[16px] font-black">Exercícios</h3>
          <div className="flex flex-col gap-2">
            {trilha.exerciciosPreview.map((nome, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[15px]">
                <span aria-hidden className="h-[9px] w-2 flex-none" style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)", background: trilha.cor }} />
                {nome}
              </div>
            ))}
            {trilha.maisExercicios > 0 && <span className="text-sm font-semibold text-apagado">+{trilha.maisExercicios} exercícios</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {trilha.regras.map((r) => (
            <span key={r} className="rounded-full border border-borda px-2.5 py-1.5 text-[13px] font-semibold">
              {r}
            </span>
          ))}
        </div>

        <p className="flex items-center gap-2.5 text-sm text-apagado">
          <IconeCamera />
          <span>
            <strong className="text-texto">Câmera:</strong> {trilha.camera}
          </span>
        </p>

        {trilha.ciencia && (
          <div className="flex flex-col gap-1.5 rounded-xl bg-[#3A3320] px-3.5 py-3">
            <p className="text-[14px] leading-relaxed">{trilha.ciencia}</p>
            {trilha.aviso && <p className="text-[13px] leading-snug text-[#E8D9A8]">{trilha.aviso}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[13px] font-semibold text-apagado">
            <span>{progressoTexto}</span>
            <span>{trilha.momento}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-superficie-2">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#FF7A59" }} />
          </div>
        </div>

        {erro && <p role="alert" className="text-sm font-semibold text-ruim">{erro}</p>}

        <div className="flex flex-col gap-2.5">
          {travada ? (
            <p className="rounded-2xl border-2 border-borda px-4 py-3 text-[15px] leading-snug text-apagado">
              Travada pela triagem: pela sua avaliação, essa intensidade é demais por enquanto.{" "}
              <Link href="/perfil/config" className="underline underline-offset-2">Já fui liberado pelo médico</Link>
            </p>
          ) : (
            <Link href={hiveAlvo ? `/desafio/${hiveAlvo}` : "#"} className={botaoPrimario}>
              {ctaTexto}
            </Link>
          )}
          <button onClick={chamarHive} disabled={chamando || !hiveAlvo || travada} className={botaoSecundario}>
            {chamando ? "Abrindo…" : "Chame sua hive"}
          </button>
        </div>
      </div>
    </>
  );
}

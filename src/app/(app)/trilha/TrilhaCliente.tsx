"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { botaoPrimario, botaoSecundario } from "@/componentes/estilos";
import {
  formatarDuracao, montarCaminho, ROTULO_EQUIPAMENTO, ROTULO_MODALIDADE, XP_BAU,
  type DadosTrilha, type ItemCaminho, type SecaoCaminho,
} from "@/dominio/trilha";
import { abrirBau, pularParaSecao } from "./acoes";
import { Hexagono, type Icone, type Visual } from "./Hexagono";

/** Distância horizontal de cada passo do zigue-zague, em px. */
const PASSO = 36;
/** Altura do topo fixo (barra + banner), para rolagem e detecção da unidade visível. */
const ALTURA_TOPO = 132;

function aparencia(item: ItemCaminho): { visual: Visual; icone: Icone; tamanho: number; nome: string } {
  if (item.tipo === "bau") {
    if (item.estado === "aberto") return { visual: "concluido", icone: "bau_aberto", tamanho: 66, nome: "Baú de XP, já aberto" };
    if (item.estado === "disponivel") return { visual: "disponivel", icone: "bau", tamanho: 66, nome: "Baú de XP, pronto para abrir" };
    return { visual: "bloqueado", icone: "bau", tamanho: 66, nome: "Baú de XP, bloqueado" };
  }
  const { desafio } = item;
  const final = item.tipo === "final";
  const base = final ? 84 : 72;
  if (desafio.estado === "concluido") return { visual: "concluido", icone: "check", tamanho: base, nome: `${desafio.titulo}, concluído` };
  if (desafio.estado === "disponivel") {
    return { visual: item.atual ? "atual" : "disponivel", icone: final ? "trofeu" : "play", tamanho: item.atual ? base + 16 : base, nome: `${desafio.titulo}, disponível` };
  }
  return { visual: "bloqueado", icone: final ? "trofeu" : "cadeado", tamanho: base, nome: `${desafio.titulo}, bloqueado` };
}

function Chama({ acesa }: { acesa: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2c1 3.5 4.5 5.5 4.5 10.5 0 1-.200 1.900-.600 2.700.900-.500 1.600-1.400 2-2.5 1.5 4.800-1.400 9.300-5.900 9.300s-7.400-3.700-6.5-8.200c.500-2.400 2-3.900 2.900-5.900.5 1 .700 2 .600 3C10.800 9 12.300 5.5 12 2z"
        fill={acesa ? "#FF8A1F" : "#5A5E68"}
      />
      <path d="M12 21c-2 0-3.5-1.5-3.5-3.5 0-1.800 1.5-2.800 2.5-4.5.300 1.200 1 1.800 2 2.5 1.200.800 2.5 1.700 2.5 3 0 1.5-1.5 2.5-3.5 2.500z" fill={acesa ? "#FFC42E" : "#7A7E88"} />
    </svg>
  );
}

export function TrilhaCliente({ dados }: { dados: DadosTrilha }) {
  const router = useRouter();
  const caminho = useMemo(() => montarCaminho(dados), [dados]);
  const todasUnidades = useMemo(
    () => caminho.secoes.flatMap((s) => s.unidades.map((u) => ({ id: u.id, secao: s.ordem, unidade: u.ordem, titulo: u.titulo }))),
    [caminho],
  );
  const [aberto, setAberto] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  const [visivel, setVisivel] = useState<string | null>(null);
  const [bauAberto, setBauAberto] = useState<{ chave: string; xp?: number; erro?: string } | null>(null);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [erroPulo, setErroPulo] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  const rolouPara = useRef<string | null>(null);

  // Ao abrir (e quando o item atual muda), rola até o desafio atual.
  useEffect(() => {
    if (!caminho.atual || rolouPara.current === caminho.atual) return;
    const primeiraVez = rolouPara.current === null;
    rolouPara.current = caminho.atual;
    const alvo = caminho.atual;
    // No próximo quadro, para a página já estar montada (e a lista de seções, fechada).
    const quadro = requestAnimationFrame(() => {
      document.getElementById(`item-${alvo}`)?.scrollIntoView({ block: "center", behavior: primeiraVez ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(quadro);
  }, [caminho.atual]);

  // O banner mostra a unidade que ocupa o meio da tela.
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      let atual: string | null = null;
      const limite = Math.max(ALTURA_TOPO + 40, window.innerHeight * 0.55);
      for (const el of document.querySelectorAll<HTMLElement>("[data-unidade]")) {
        if (el.getBoundingClientRect().top <= limite) atual = el.dataset.unidade!;
        else break;
      }
      setVisivel(atual);
    };
    const aoRolar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      window.removeEventListener("scroll", aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [caminho]);

  // Card aberto: fecha ao tocar fora dele (outro hexágono troca de card direto) ou com Esc.
  useEffect(() => {
    if (!aberto) return;
    const aoTocar = (evento: PointerEvent) => {
      if (!(evento.target as Element).closest("[data-hex], [data-cartao]")) setAberto(null);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(null);
    };
    document.addEventListener("pointerdown", aoTocar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoTocar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const banner = todasUnidades.find((u) => u.id === visivel) ?? todasUnidades[0];

  const irParaSecao = (secao: SecaoCaminho) => {
    setLista(false);
    setConfirmar(null);
    const alvo = caminho.atual && secao.unidades.some((u) => u.itens.some((i) => i.chave === caminho.atual)) ? `item-${caminho.atual}` : `secao-${secao.id}`;
    requestAnimationFrame(() => document.getElementById(alvo)?.scrollIntoView({ block: alvo.startsWith("item") ? "center" : "start", behavior: "smooth" }));
  };

  const pular = (secao: SecaoCaminho) => {
    setErroPulo(null);
    iniciar(async () => {
      const resultado = await pularParaSecao(secao.id);
      if (!resultado.ok) {
        setErroPulo(resultado.erro ?? "Não deu certo.");
        return;
      }
      setLista(false);
      setConfirmar(null);
      router.refresh();
    });
  };

  const abrir = (item: Extract<ItemCaminho, { tipo: "bau" }>) => {
    iniciar(async () => {
      const resultado = await abrirBau(item.unidade, item.posicao);
      setBauAberto({ chave: item.chave, xp: resultado.xp, erro: resultado.erro });
      if (resultado.ok) router.refresh();
    });
  };

  return (
    <main className="pb-6">
      {/* Topo fixo: nível, ofensiva e XP do dia; abaixo, o banner da unidade. */}
      <div className="sticky top-0 z-30 bg-fundo/95 px-4 pb-3 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex h-11 items-center justify-between gap-3">
          <p className="rounded-full border border-borda bg-superficie px-3.5 py-1.5 text-sm font-black" aria-label={`Nível atual: ${dados.nivel_atual}`}>
            Nível {dados.nivel_atual}
          </p>
          <div className="flex items-center gap-4">
            <p className="flex items-center gap-1.5 text-lg font-black tabular-nums" aria-label={`Ofensiva de ${dados.ofensiva} ${dados.ofensiva === 1 ? "dia" : "dias"}`}>
              <Chama acesa={dados.fez_hoje} />
              <span className={dados.fez_hoje ? "text-[#FF8A1F]" : "text-apagado"}>{dados.ofensiva}</span>
            </p>
            <p className="flex items-center gap-1.5 text-lg font-black tabular-nums" aria-label={`${dados.xp_hoje} de ${dados.meta_xp} XP hoje`}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path d="M13.5 2L4.5 13.500h6L9.5 22l9.5-12h-6.500z" fill="#FFC42E" />
              </svg>
              <span className={dados.xp_hoje >= dados.meta_xp ? "text-mel" : ""}>
                {dados.xp_hoje}
                <span className="text-sm text-apagado">/{dados.meta_xp}</span>
              </span>
            </p>
          </div>
        </div>
        {banner && (
          <div className="mt-2.5 flex items-stretch overflow-hidden rounded-2xl bg-mel text-black shadow-[0_4px_0_#C28E00]">
            <div className="min-w-0 flex-1 px-4 py-2.5">
              <p className="text-[12px] font-black uppercase tracking-[0.12em] text-black/65">
                Seção {banner.secao} · Unidade {banner.unidade}
              </p>
              <p className="truncate text-lg font-black leading-tight">{banner.titulo}</p>
            </div>
            <button
              onClick={() => setLista(true)}
              aria-label="Ver todas as seções"
              className="flex w-14 shrink-0 items-center justify-center border-l-2 border-black/15 active:bg-black/10"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M9 6h11M9 12h11M9 18h11M4 6h.010M4 12h.010M4 18h.01" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="px-4">
        {caminho.secoes.map((secao) => (
          <section key={secao.id} id={`secao-${secao.id}`} style={{ scrollMarginTop: ALTURA_TOPO + 8 }} aria-label={`Seção ${secao.ordem}: ${secao.tema}`}>
            {secao.ordem > 1 && (
              <div className={`mb-2 mt-10 rounded-2xl border px-4 py-3 ${secao.liberada ? "border-mel/50 bg-mel/10" : "border-borda bg-superficie"}`}>
                <p className="text-[12px] font-black uppercase tracking-[0.12em] text-apagado">Seção {secao.ordem}</p>
                <p className="text-xl font-black leading-tight">{secao.tema}</p>
                {!secao.liberada && (
                  <p className="mt-1 text-sm text-apagado">Bloqueada. Conclua a seção anterior, ou pule para cá pela lista de seções.</p>
                )}
              </div>
            )}
            {secao.unidades.map((unidade) => (
              <div key={unidade.id}>
                <div data-unidade={unidade.id} className="flex items-center gap-3 pb-3 pt-7">
                  <span className="h-0.5 flex-1 rounded bg-borda" />
                  <h2 className="max-w-[70%] text-center text-base font-black leading-tight text-apagado">{unidade.titulo}</h2>
                  <span className="h-0.5 flex-1 rounded bg-borda" />
                </div>
                <ol>
                  {unidade.itens.map((item) => {
                    const a = aparencia(item);
                    const estaAberto = aberto === item.chave;
                    const x = item.deslocamento * PASSO;
                    return (
                      <li key={item.chave} id={`item-${item.chave}`} className="relative flex justify-center" style={{ height: a.tamanho * 1.07 + (item.atual ? 46 : 20), paddingTop: item.atual ? 34 : 8, scrollMarginTop: ALTURA_TOPO + 24 }}>
                        <div className="relative" style={{ transform: `translateX(${x}px)` }}>
                          {item.atual && (
                            <>
                              <span aria-hidden className="pulso-hex pointer-events-none absolute inset-0 rounded-full bg-mel/40" />
                              <span aria-hidden className="balao-comecar pointer-events-none absolute -top-8 left-1/2 z-[5] whitespace-nowrap rounded-xl border-2 border-borda bg-superficie px-3 py-1 text-sm font-black tracking-wide text-mel">
                                COMEÇAR
                              </span>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setBauAberto(null);
                              setAberto(estaAberto ? null : item.chave);
                            }}
                            aria-label={a.nome}
                            aria-expanded={estaAberto}
                            data-hex
                            className={`hex-botao relative block rounded-full ${estaAberto ? "z-20" : ""}`}
                          >
                            <Hexagono visual={a.visual} icone={a.icone} tamanho={a.tamanho} />
                          </button>
                        </div>
                        {estaAberto && (
                          <CartaoItem
                            item={item}
                            secaoLiberada={secao.liberada}
                            x={x}
                            ocupado={ocupado}
                            resultadoBau={bauAberto?.chave === item.chave ? bauAberto : null}
                            aoAbrirBau={abrir}
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>
        ))}
        <p className="mt-10 text-center text-sm text-apagado">Fim da trilha por enquanto. Mais níveis estão a caminho.</p>
      </div>

      {lista && (
        <div role="dialog" aria-modal="true" aria-label="Seções" className="fixed inset-0 z-40 mx-auto flex w-full max-w-[430px] flex-col bg-fundo">
          <div className="flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
            <h2 className="text-2xl font-black">Seções</h2>
            <button onClick={() => { setLista(false); setConfirmar(null); }} aria-label="Fechar" className="-mr-2 flex h-12 w-12 items-center justify-center rounded-full active:bg-superficie">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <ul className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-8">
            {caminho.secoes.map((secao) => {
              const atual = secao.id === dados.nivel_atual;
              const pct = secao.total ? Math.round((secao.feitos / secao.total) * 100) : 0;
              return (
                <li key={secao.id} className={`rounded-2xl border p-4 ${atual ? "border-mel bg-mel/10" : "border-borda bg-superficie"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-[12px] font-black uppercase tracking-[0.12em] ${atual ? "text-mel" : "text-apagado"}`}>
                        Seção {secao.ordem}
                        {atual ? " · Você está aqui" : secao.concluida ? " · Concluída" : ""}
                      </p>
                      <p className="mt-0.5 text-xl font-black leading-tight">{secao.tema}</p>
                      <p className="mt-0.5 text-sm text-apagado">
                        {secao.unidades.length} unidades ·{" "}
                        {secao.equipamentos.length ? secao.equipamentos.map((e) => ROTULO_EQUIPAMENTO[e] ?? e).join(" + ") : "Sem equipamento"}
                      </p>
                    </div>
                    {!secao.liberada && (
                      <svg className="mt-1 shrink-0 text-apagado" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-label="Bloqueada">
                        <path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zm2 0h6V8a3 3 0 0 0-6 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div role="progressbar" aria-valuemin={0} aria-valuemax={secao.total} aria-valuenow={secao.feitos} aria-label={`Progresso da seção ${secao.ordem}`} className="h-3 flex-1 overflow-hidden rounded-full bg-superficie-2">
                      <div className="h-full rounded-full bg-mel" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums text-apagado">
                      {secao.feitos}/{secao.total}
                    </span>
                  </div>
                  {secao.liberada ? (
                    <button onClick={() => irParaSecao(secao)} className={`${atual ? botaoPrimario : botaoSecundario} mt-4 h-12 text-base`}>
                      {atual ? "Continuar" : secao.concluida ? "Rever" : "Ir para a seção"}
                    </button>
                  ) : confirmar === secao.id ? (
                    <div className="surgir mt-4 rounded-xl border border-borda bg-fundo p-3">
                      <p className="text-[15px] font-bold leading-snug">Pular para a Seção {secao.ordem}?</p>
                      <p className="mt-1 text-sm leading-relaxed text-apagado">
                        Ela fica liberada e você continua a partir dela. As seções anteriores continuam disponíveis para voltar depois.
                        {secao.equipamentos.length > 0 && ` Esta seção pede: ${secao.equipamentos.map((e) => (ROTULO_EQUIPAMENTO[e] ?? e).toLowerCase()).join(" e ")}.`}
                      </p>
                      {erroPulo && <p role="alert" className="mt-2 text-sm text-ruim">{erroPulo}</p>}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={() => setConfirmar(null)} className={`${botaoSecundario} h-12 text-base`}>
                          Agora não
                        </button>
                        <button onClick={() => pular(secao)} disabled={ocupado} className={`${botaoPrimario} h-12 text-base`}>
                          {ocupado ? "Pulando…" : "Pular"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setErroPulo(null); setConfirmar(secao.id); }} className={`${botaoSecundario} mt-4 h-12 text-base`}>
                      Pular para cá
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}

function CartaoItem({
  item, secaoLiberada, x, ocupado, resultadoBau, aoAbrirBau,
}: {
  item: ItemCaminho;
  secaoLiberada: boolean;
  x: number;
  ocupado: boolean;
  resultadoBau: { xp?: number; erro?: string } | null;
  aoAbrirBau: (item: Extract<ItemCaminho, { tipo: "bau" }>) => void;
}) {
  let titulo: string;
  let detalhe: string;
  let corpo: React.ReactNode;
  let destaque = false;

  if (item.tipo === "bau") {
    titulo = "Baú de XP";
    detalhe = `+${XP_BAU} XP`;
    if (resultadoBau?.xp) {
      destaque = true;
      corpo = <p role="status" className="text-lg font-black">+{resultadoBau.xp} XP para você!</p>;
    } else if (item.estado === "aberto") {
      corpo = <p className="text-[15px] font-semibold">Você já abriu este baú.</p>;
    } else if (item.estado === "disponivel") {
      destaque = true;
      corpo = (
        <>
          {resultadoBau?.erro && <p role="alert" className="mb-2 text-sm font-semibold">{resultadoBau.erro}</p>}
          <button onClick={() => aoAbrirBau(item)} disabled={ocupado} className="flex h-12 w-full items-center justify-center rounded-xl bg-black text-base font-black text-mel disabled:opacity-60">
            {ocupado ? "Abrindo…" : "Abrir baú"}
          </button>
        </>
      );
    } else {
      corpo = <p className="text-[15px] font-semibold">Complete os desafios anteriores para abrir.</p>;
    }
  } else {
    const { desafio } = item;
    titulo = desafio.titulo;
    detalhe = [formatarDuracao(desafio.duracao_s), `+${desafio.xp} XP`, desafio.equipamento ? ROTULO_EQUIPAMENTO[desafio.equipamento] : null].filter(Boolean).join(" · ");
    if (desafio.estado === "disponivel" || desafio.estado === "concluido") {
      destaque = true;
      corpo = (
        <Link href={`/desafio/${desafio.id}`} className="flex h-12 w-full items-center justify-center rounded-xl bg-black text-base font-black text-mel">
          {desafio.estado === "concluido" ? "Refazer" : "Começar"}
        </Link>
      );
    } else if (desafio.estado === "travado") {
      corpo = (
        <p className="text-[15px] font-semibold leading-snug">
          Travado por segurança: pela sua triagem, este desafio é intenso demais por enquanto.{" "}
          <Link href="/perfil" className="underline underline-offset-2">Já fui liberado pelo médico</Link>
        </p>
      );
    } else {
      corpo = (
        <p className="text-[15px] font-semibold">
          {secaoLiberada ? "Complete os anteriores para liberar." : "Esta seção está bloqueada. Abra a lista de seções para pular para cá."}
        </p>
      );
    }
  }

  const modalidade = item.tipo === "bau" ? null : ROTULO_MODALIDADE[item.desafio.modalidade];
  return (
    <div data-cartao className={`surgir absolute inset-x-0 top-[calc(100%-6px)] z-20 rounded-2xl p-4 shadow-[0_10px_30px_rgb(0_0_0/0.55)] ${destaque ? "bg-mel text-black" : "border-2 border-borda bg-superficie-2 text-texto"}`}>
      <span aria-hidden className={`absolute -top-2 h-4 w-4 rotate-45 rounded-sm ${destaque ? "bg-mel" : "border-l-2 border-t-2 border-borda bg-superficie-2"}`} style={{ left: `calc(50% + ${x}px - 8px)` }} />
      <p className="text-lg font-black leading-tight">{titulo}</p>
      <p className={`mb-3 mt-0.5 text-sm font-semibold ${destaque ? "text-black/70" : "text-apagado"}`}>
        {modalidade && modalidade !== titulo ? `${modalidade} · ` : ""}
        {detalhe}
      </p>
      {corpo}
    </div>
  );
}

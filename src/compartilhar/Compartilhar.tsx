"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { botaoPrimario, botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import type { Gancho } from "@/conteudo/ganchos";
import type { DadosCard } from "@/dominio/card";
import { escolherGancho, preencherGancho, trocarGancho, type EstadoDoTreino } from "@/dominio/ganchos";
import { montarLinkConvite } from "@/lib/convite";
import { registrarConviteComGancho } from "./acoes";
import {
  carregarFontes, desenharAdesivo, desenharCard, paraPng, TAMANHOS,
  type Formato, type Fundo, type Toggles,
} from "./desenhar-card";
import type { EstadoCardSalvo, OrigemFundo } from "./memoria";

type Origem = OrigemFundo;

const assinarOrigem = () => () => {};

/** Estado do treino para a tabela 3.1 (docs/GANCHOS_CONVITE.md) a partir do card já montado. */
function estadoDoTreino(dados: DadosCard): EstadoDoTreino {
  const bloco = dados.blocos[0];
  return {
    recordeNovo: dados.recorde?.novo ?? false,
    ofensivaDias: dados.ofensiva,
    emHive: dados.hive !== null,
    variaveis: {
      nome: dados.usuario,
      dias: dados.ofensiva,
      exercicio: bloco?.exercicio.toLowerCase(),
      reps: bloco && bloco.tipo !== "tempo" ? bloco.numero : undefined,
      tempo: bloco?.tipo === "tempo" ? bloco.valor : undefined,
    },
  };
}

const NOME_CARD = "hive-break-treino.png";
const NOME_ADESIVO = "hive-break-adesivo.png";
const botaoMenor =
  "flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-borda px-2 text-[15px] font-bold text-texto active:bg-superficie-2 disabled:opacity-50";

/**
 * Tela de criação do card. Tudo acontece no aparelho: a selfie e a foto da
 * galeria só passam pelo <canvas>; o PNG sai pelo menu de compartilhar do
 * celular ou pelo download. Nada é enviado ao servidor.
 */
export function Compartilhar({
  dados, codigoConvite, aoFechar, inicial, aoMudar,
}: {
  dados: DadosCard;
  codigoConvite: string;
  aoFechar: () => void;
  /** Opções recuperadas depois de a página recarregar. */
  inicial?: EstadoCardSalvo;
  /** Guarda as opções para sobreviverem a um recarregamento. */
  aoMudar?: (estado: Partial<EstadoCardSalvo>) => void;
}) {
  const [formato, setFormato] = useState<Formato>(inicial?.formato ?? "9:16");
  const [origem, setOrigem] = useState<Origem>(inicial?.foto ? inicial.origem : "hive");
  const [foto, setFotoEstado] = useState<Fundo | null>(null);
  const [toggles, setToggles] = useState<Toggles>(inicial?.toggles ?? { recorde: true, hive: true, pse: false });
  const [previa, setPrevia] = useState<{ url: string; nome: string } | null>(null);
  // A tela só aparece depois de um toque (nunca no HTML do servidor).
  const [ios] = useState(ehIOS);
  const [camera, setCamera] = useState(false);
  const [fontesProntas, setFontesProntas] = useState(false);
  const [card, setCard] = useState<{ blob: Blob; podeCompartilhar: boolean } | null>(null);
  const [adesivo, setAdesivo] = useState<Blob | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const canvasCard = useRef<HTMLCanvasElement>(null);
  const canvasAdesivo = useRef<HTMLCanvasElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const estado = useMemo(() => estadoDoTreino(dados), [dados]);
  const [usarFrase, setUsarFrase] = useState(true);
  const [gancho, setGancho] = useState<Gancho | null>(() => escolherGancho("compartilhar_treino", estado));
  const origemLink = useSyncExternalStore(assinarOrigem, () => window.location.origin, () => "");
  const link = montarLinkConvite(origemLink || "https://hivebreak.app", codigoConvite, gancho ? { familia: gancho.familia, id: gancho.id } : null);
  const textoCompartilhar = usarFrase && gancho ? `${preencherGancho(gancho.texto, estado.variaveis)}\n${link}` : link;

  const trocarFrase = () => {
    if (!gancho) return;
    const outro = trocarGancho(gancho, "compartilhar_treino", estado.variaveis);
    if (outro) setGancho(outro);
  };

  useEffect(() => {
    let vivo = true;
    carregarFontes().then(() => vivo && setFontesProntas(true));
    return () => {
      vivo = false;
    };
  }, []);

  const fundo: Fundo = origem !== "hive" && foto ? foto : { tipo: "hive" };

  // Guarda a foto reduzida para ela voltar se a página recarregar.
  const setFoto = (f: Fundo, de: Origem) => {
    setFotoEstado(f);
    setOrigem(de);
    if (f.tipo === "foto" && f.imagem instanceof HTMLCanvasElement) aoMudar?.({ origem: de, foto: comoJpeg(f.imagem) });
  };

  // Foto que estava escolhida antes de a página recarregar.
  useEffect(() => {
    if (!inicial?.foto) return;
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      if (!vivo) return;
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")?.drawImage(img, 0, 0);
      setFotoEstado({ tipo: "foto", imagem: c, largura: c.width, altura: c.height });
    };
    img.src = inicial.foto;
    return () => {
      vivo = false;
    };
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    aoMudar?.({ formato, toggles, origem });
    // aoMudar muda a cada render do pai; o que importa são as opções.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formato, toggles, origem]);

  // Libera a prévia de salvar ao fechar.
  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa.url);
  }, [previa]);

  /**
   * Salva a imagem sem sair da página. No iPhone o <a download> pode trocar a
   * página pela imagem (sem voltar), então lá usamos o menu de compartilhar
   * (que tem "Salvar imagem") ou mostramos a imagem para tocar e segurar.
   */
  const salvar = async (blob: Blob, nome: string) => {
    setAviso(null);
    if (!ios) {
      baixar(blob, nome);
      return;
    }
    const file = new File([blob], nome, { type: "image/png" });
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    setPrevia({ url: URL.createObjectURL(blob), nome });
  };

  // Redesenha e já deixa o PNG pronto: o navigator.share precisa ser chamado
  // logo no toque, sem esperar o toBlob (o Safari perde o gesto).
  useEffect(() => {
    if (!fontesProntas || !canvasCard.current || !canvasAdesivo.current) return;
    let vivo = true;
    setCard(null);
    setAdesivo(null);
    desenharCard(canvasCard.current, dados, formato, fundo, toggles);
    desenharAdesivo(canvasAdesivo.current, dados, toggles);
    Promise.all([paraPng(canvasCard.current), paraPng(canvasAdesivo.current)])
      .then(([b, a]) => {
        if (!vivo) return;
        const file = new File([b], NOME_CARD, { type: "image/png" });
        const podeCompartilhar = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
        setCard({ blob: b, podeCompartilhar });
        setAdesivo(a);
      })
      .catch(() => vivo && setAviso("Não consegui gerar a imagem. Tente de novo."));
    return () => {
      vivo = false;
    };
    // `fundo` muda junto com `origem` e `foto`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontesProntas, dados, formato, origem, foto, toggles]);

  const escolherGaleria = async (f: File | undefined) => {
    if (!f) return;
    setAviso(null);
    try {
      setFoto(await carregarImagem(f), "galeria");
    } catch {
      setAviso("Não consegui abrir essa imagem. Tente outra foto.");
    }
  };

  const compartilhar = async () => {
    if (!card) return;
    setAviso(null);
    if (gancho) void registrarConviteComGancho(gancho.familia, gancho.id).catch(() => {});
    const file = new File([card.blob], NOME_CARD, { type: "image/png" });
    try {
      await navigator.share({ files: [file], text: textoCompartilhar });
    } catch (e) {
      if ((e as DOMException).name !== "AbortError") void salvar(card.blob, NOME_CARD);
    }
  };

  const copiarAdesivo = async () => {
    if (!adesivo) return;
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      setAviso("Este navegador não copia imagens. Use “Baixar adesivo”.");
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": adesivo })]);
      setAviso("Adesivo copiado. Cole no story do Instagram.");
    } catch {
      setAviso("Não consegui copiar. Use “Baixar adesivo”.");
    }
  };

  const extras: { chave: keyof Toggles; rotulo: string; ajuda: string }[] = [
    dados.recorde && { chave: "recorde" as const, rotulo: dados.recorde.novo ? "Novo recorde" : "Recorde pessoal", ajuda: dados.recorde.texto },
    dados.hive && { chave: "hive" as const, rotulo: "Sua hive hoje", ajuda: dados.hive },
    dados.pse && { chave: "pse" as const, rotulo: "Esforço (PSE)", ajuda: dados.pse },
  ].filter((e): e is { chave: keyof Toggles; rotulo: string; ajuda: string } => Boolean(e));

  if (camera) {
    return (
      <Selfie
        aoTirar={(f) => {
          setFoto(f, "selfie");
          setCamera(false);
        }}
        aoCancelar={(erro) => {
          setCamera(false);
          if (erro) setAviso(erro);
        }}
      />
    );
  }

  const { largura, altura } = TAMANHOS[formato];

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <button onClick={aoFechar} aria-label="Voltar para o resultado" className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-apagado active:bg-superficie">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <h1 className="text-2xl font-black leading-tight">Compartilhar treino</h1>
      </header>

      <div className="mx-auto w-full max-w-[300px]">
        <canvas
          ref={canvasCard}
          width={largura}
          height={altura}
          role="img"
          aria-label={`Prévia do card: ${dados.ofensiva} ${dados.rotuloOfensiva}, ${dados.blocos.map((b) => `${b.exercicio} ${b.valor} ${b.unidade}`).join(", ")}`}
          className="block h-auto w-full rounded-2xl border border-borda bg-superficie"
          style={{ aspectRatio: `${largura} / ${altura}` }}
        />
      </div>

      <section aria-label="Fundo">
        <p className={sobrelinha}>Fundo</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <OpcaoFundo ativa={origem === "selfie" && Boolean(foto)} onClick={() => setCamera(true)} rotulo="Tirar selfie" />
          <OpcaoFundo ativa={origem === "galeria" && Boolean(foto)} onClick={() => arquivo.current?.click()} rotulo="Da galeria" />
          <OpcaoFundo ativa={origem === "hive"} onClick={() => setOrigem("hive")} rotulo="Sem foto" />
        </div>
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void escolherGaleria(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-[13px] leading-snug text-apagado">A foto fica só no seu celular: o card é montado aqui e não vai para o servidor.</p>
      </section>

      <section aria-label="Formato">
        <p className={sobrelinha}>Formato</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["9:16", "4:5"] as Formato[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormato(f)}
              aria-pressed={formato === f}
              className={`h-12 rounded-xl border text-base font-black ${formato === f ? "border-mel bg-mel/10 text-mel" : "border-borda bg-superficie text-texto active:bg-superficie-2"}`}
            >
              {f} <span className="font-semibold text-apagado">{f === "9:16" ? "story" : "feed"}</span>
            </button>
          ))}
        </div>
      </section>

      {extras.length > 0 && (
        <section aria-label="O que aparece no card">
          <p className={sobrelinha}>No card</p>
          <ul className={`${cartao} mt-2 flex flex-col divide-y divide-borda py-1`}>
            {extras.map((e) => (
              <li key={e.chave}>
                <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-bold">{e.rotulo}</span>
                    <span className="block truncate text-[13px] text-apagado">{e.ajuda}</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={toggles[e.chave]}
                    onChange={(ev) => setToggles((t) => ({ ...t, [e.chave]: ev.target.checked }))}
                    className="peer sr-only"
                  />
                  <span aria-hidden className="relative h-8 w-14 shrink-0 rounded-full bg-superficie-2 transition-colors peer-checked:bg-mel peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-mel after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-texto after:transition-transform peer-checked:after:translate-x-6 peer-checked:after:bg-black" />
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gancho && (
        <section aria-label="Frase de convite" className={`${cartao} flex flex-col gap-3`}>
          <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block font-bold">Frase de convite</span>
              <span className="block truncate text-[13px] text-apagado">Vai junto com a imagem e o link</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={usarFrase}
              onChange={(e) => setUsarFrase(e.target.checked)}
              className="peer sr-only"
            />
            <span aria-hidden className="relative h-8 w-14 shrink-0 rounded-full bg-superficie-2 transition-colors peer-checked:bg-mel peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-mel after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-texto after:transition-transform peer-checked:after:translate-x-6 peer-checked:after:bg-black" />
          </label>
          {usarFrase && (
            <>
              <p className="text-[15px] font-semibold leading-snug">“{preencherGancho(gancho.texto, estado.variaveis)}”</p>
              <button onClick={trocarFrase} className={`${botaoMenor} w-full`}>Trocar frase</button>
            </>
          )}
        </section>
      )}

      {aviso && <p role="status" className="text-[15px] font-semibold leading-snug text-mel">{aviso}</p>}

      <div className="flex flex-col gap-3">
        {card?.podeCompartilhar ? (
          <button onClick={compartilhar} className={botaoPrimario}>Compartilhar</button>
        ) : (
          <button onClick={() => card && void salvar(card.blob, NOME_CARD)} disabled={!card} className={botaoPrimario}>
            {card ? (ios ? "Salvar imagem" : "Baixar imagem") : "Montando o card…"}
          </button>
        )}
        {card?.podeCompartilhar && (
          <button onClick={() => void salvar(card.blob, NOME_CARD)} className={botaoSecundario}>{ios ? "Salvar imagem" : "Baixar imagem"}</button>
        )}
      </div>

      <section aria-label="Adesivo" className={`${cartao} flex flex-col gap-3`}>
        <div>
          <h2 className="text-lg font-black leading-tight">Adesivo transparente</h2>
          <p className="mt-0.5 text-sm text-apagado">Só os dados, sem fundo. Cole por cima da sua própria foto no story.</p>
        </div>
        <div className="xadrez rounded-xl p-3">
          <canvas ref={canvasAdesivo} role="img" aria-label="Prévia do adesivo" className="mx-auto block h-auto w-full max-w-[260px]" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={copiarAdesivo} disabled={!adesivo} className={botaoMenor}>Copiar adesivo</button>
          <button onClick={() => adesivo && void salvar(adesivo, NOME_ADESIVO)} disabled={!adesivo} className={botaoMenor}>{ios ? "Salvar adesivo" : "Baixar adesivo"}</button>
        </div>
      </section>
      {previa && (
        <div role="dialog" aria-modal="true" aria-label="Salvar imagem" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/90 px-5 py-[max(1.5rem,env(safe-area-inset-top))]">
          <p className="text-center text-lg font-black">Toque e segure a imagem e escolha “Salvar na Fotos”</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- blob local, sem otimização do Next */}
          <img src={previa.url} alt="Card do treino" className="max-h-[70dvh] w-auto max-w-full rounded-2xl" style={{ WebkitTouchCallout: "default" }} />
          <button onClick={() => setPrevia(null)} className={`${botaoSecundario} max-w-sm`}>Voltar para o card</button>
        </div>
      )}
    </main>
  );
}

function OpcaoFundo({ ativa, onClick, rotulo }: { ativa: boolean; onClick: () => void; rotulo: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativa}
      className={`h-14 rounded-xl border px-1 text-[15px] font-bold leading-tight ${ativa ? "border-mel bg-mel/10 text-mel" : "border-borda bg-superficie text-texto active:bg-superficie-2"}`}
    >
      {rotulo}
    </button>
  );
}

/** Câmera frontal só para a selfie do card. O vídeo nunca sai do aparelho. */
function Selfie({ aoTirar, aoCancelar }: { aoTirar: (f: Fundo) => void; aoCancelar: (erro?: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let vivo = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        aoCancelar("Este navegador não dá acesso à câmera. Escolha uma foto da galeria.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "user" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (!vivo) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
          setPronta(true);
        }
      } catch (e) {
        const nome = (e as DOMException).name;
        aoCancelar(
          nome === "NotAllowedError" || nome === "SecurityError"
            ? "A câmera foi bloqueada. Libere a permissão nas configurações do navegador ou escolha uma foto da galeria."
            : "Não consegui abrir a câmera. Escolha uma foto da galeria.",
        );
      }
    })();
    return () => {
      vivo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // Abre uma vez ao montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tirar = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Espelhada, como a pessoa se viu na prévia.
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    aoTirar({ tipo: "foto", imagem: c, largura: c.width, altura: c.height });
  };

  return (
    <main className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={video} playsInline muted className="h-full w-full flex-1 -scale-x-100 object-cover" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/80 to-transparent px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10">
        <button onClick={tirar} disabled={!pronta} className={botaoPrimario}>{pronta ? "Tirar foto" : "Abrindo a câmera…"}</button>
        <button onClick={() => aoCancelar()} className={botaoSecundario}>Cancelar</button>
      </div>
    </main>
  );
}

/** Abre a foto da galeria e reduz para no máximo 2160 px (o card tem 1920). */
async function carregarImagem(f: File): Promise<Fundo> {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // <img> já respeita a orientação EXIF da foto do celular.
    const escala = Math.min(1, 2160 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return { tipo: "foto", imagem: c, largura: c.width, altura: c.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** iPhone e iPad (o iPadOS se apresenta como Mac, mas tem toque). */
function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Foto reduzida para guardar na aba (cabe no sessionStorage). */
function comoJpeg(c: HTMLCanvasElement): string | null {
  try {
    const escala = Math.min(1, 1440 / Math.max(c.width, c.height));
    const r = document.createElement("canvas");
    r.width = Math.round(c.width * escala);
    r.height = Math.round(c.height * escala);
    r.getContext("2d")?.drawImage(c, 0, 0, r.width, r.height);
    return r.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

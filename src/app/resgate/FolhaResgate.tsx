"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { botaoPrimario, botaoSecundario, campoTexto, cartao, sobrelinha } from "@/componentes/estilos";
import type { DadosResgate, FamiliaResgate, SugestaoResgate } from "@/conteudo/resgate-ganchos";
import { escolherGanchosResgate, proximaFraseDaFamilia } from "@/conteudo/resgate-ganchos";
import { abrirHiveParaResgate, buscarSugestoesResgate, enviarResgate } from "./acoes";

const assinarOrigem = () => () => {};
const ROTULO_FAMILIA: Record<FamiliaResgate, string> = { D: "Desafio", B: "Benefício", C: "Companhia" };

/**
 * Folha de escolha de mensagem (docs/RESGATE.md, seção 4): 3 sugestões, uma
 * por família, com os dados reais de quem resgata. "Trocar frase" pega a
 * próxima da mesma família; dá para escrever a própria também.
 */
export function FolhaResgate({
  amigoId, apelido, appDisponivel, aoFechar, aoEnviado,
}: {
  amigoId: string;
  apelido: string;
  appDisponivel: boolean;
  aoFechar: () => void;
  aoEnviado: () => void;
}) {
  const origem = useSyncExternalStore(assinarOrigem, () => window.location.origin, () => "");
  const [sugestoes, setSugestoes] = useState<SugestaoResgate[] | null>(null);
  const [dados, setDados] = useState<DadosResgate>({});
  const [hiveId, setHiveId] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<SugestaoResgate | null>(null);
  const [familiaEnvio, setFamiliaEnvio] = useState<FamiliaResgate>("C");
  const [texto, setTexto] = useState("");
  const [enviando, iniciar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ compartilhar?: { texto: string; caminho: string } } | null>(null);

  useEffect(() => {
    let vivo = true;
    buscarSugestoesResgate().then((r) => {
      if (!vivo) return;
      setSugestoes(r.sugestoes);
      setDados(r.dados);
      setSelecionada(r.sugestoes[0]);
      setFamiliaEnvio(r.sugestoes[0].familia);
      setTexto(r.sugestoes[0].texto);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = (s: SugestaoResgate) => {
    setSelecionada(s);
    setFamiliaEnvio(s.familia);
    setTexto(s.texto);
  };

  const trocarFrase = (atual: SugestaoResgate) => {
    const proxima = proximaFraseDaFamilia(atual.id, { ...dados, vaiAbrirHive: atual.familia === "C" && hiveId !== null });
    setSugestoes((lista) => lista?.map((s) => (s.familia === proxima.familia ? proxima : s)) ?? lista);
    if (selecionada?.familia === proxima.familia) {
      setSelecionada(proxima);
      setTexto(proxima.texto);
    }
  };

  const escreverPropria = () => {
    setSelecionada(null);
    setTexto("");
  };

  const chamarComHive = () => {
    setAviso(null);
    iniciar(async () => {
      const r = await abrirHiveParaResgate();
      if (!r.ok || !r.hiveId) {
        setAviso(r.erro ?? "Não consegui abrir a hive.");
        return;
      }
      setHiveId(r.hiveId);
      const rc1 = escolherGanchosResgate({ ...dados, vaiAbrirHive: true }).find((s) => s.familia === "C")!;
      setSugestoes((lista) => lista?.map((s) => (s.familia === "C" ? rc1 : s)) ?? lista);
      escolher(rc1);
    });
  };

  const compartilharWhatsApp = async (caminho: string, textoEnviado: string) => {
    const mensagem = `${textoEnviado}\n${origem}${caminho}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: mensagem });
        return;
      } catch {
        return; // a pessoa fechou o menu de compartilhar.
      }
    }
    try {
      await navigator.clipboard.writeText(mensagem);
      setAviso("Mensagem copiada. Cole no WhatsApp.");
    } catch {
      setAviso(mensagem);
    }
  };

  const enviar = (canal: "app" | "whatsapp" | "hive") => {
    const textoFinal = texto.trim();
    if (!textoFinal) {
      setAviso("Escreva uma mensagem antes de enviar.");
      return;
    }
    setAviso(null);
    iniciar(async () => {
      const r = await enviarResgate(amigoId, familiaEnvio, selecionada?.id ?? "LIVRE", textoFinal, canal, hiveId ?? undefined);
      if (!r.ok) {
        setAviso(r.erro ?? "Não consegui enviar. Tente de novo.");
        return;
      }
      if (r.compartilhar) {
        await compartilharWhatsApp(r.compartilhar.caminho, r.compartilhar.texto);
      }
      setResultado(r);
    });
  };

  if (resultado) {
    return (
      <div role="dialog" aria-modal="true" aria-label="Resgate enviado" className="fixed inset-0 z-40 mx-auto flex w-full max-w-[430px] flex-col items-center justify-center gap-4 bg-fundo px-6 text-center">
        <p className="text-5xl">🐝</p>
        <h2 className="text-2xl font-black">Chamada enviada para {apelido}</h2>
        <p className="text-base text-apagado">Se {apelido} fizer um desafio em até 48h, você ganha um protetor de ofensiva.</p>
        <button onClick={aoEnviado} className={`${botaoPrimario} mt-4`}>Fechar</button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Chamar ${apelido}`} className="fixed inset-0 z-40 mx-auto flex w-full max-w-[430px] flex-col bg-fundo">
      <div className="flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h2 className="text-xl font-black">Chamar {apelido}</h2>
        <button onClick={aoFechar} aria-label="Fechar" className="-mr-2 flex h-12 w-12 items-center justify-center rounded-full active:bg-superficie">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {!sugestoes ? (
          <p className="py-10 text-center text-apagado">Preparando as mensagens…</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sugestoes.map((s) => (
              <div key={s.familia} className={`${cartao} ${selecionada?.familia === s.familia ? "border-mel bg-mel/10" : ""}`}>
                <button onClick={() => escolher(s)} className="w-full text-left">
                  <p className={sobrelinha}>{ROTULO_FAMILIA[s.familia]}</p>
                  <p className="mt-1 text-base leading-snug">{s.texto}</p>
                </button>
                <div className="mt-2 flex items-center gap-3">
                  <button onClick={() => trocarFrase(s)} className="text-sm font-bold text-mel">Trocar frase</button>
                  {s.familia === "C" && !hiveId && (
                    <button onClick={chamarComHive} disabled={enviando} className="text-sm font-bold text-mel disabled:opacity-50">
                      Abrir uma hive agora
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={escreverPropria} className="self-start text-sm font-bold text-apagado underline">
              Escrever a própria mensagem
            </button>
            {selecionada === null && (
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, 300))}
                placeholder="Escreva sua mensagem"
                rows={3}
                autoFocus
                className={`${campoTexto} h-auto py-3`}
              />
            )}
          </div>
        )}
        {aviso && <p className="mt-3 text-sm text-ruim">{aviso}</p>}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-borda px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {appDisponivel && (
          <button onClick={() => enviar("app")} disabled={enviando || !sugestoes} className={botaoPrimario}>
            Enviar pelo app
          </button>
        )}
        <button
          onClick={() => enviar(hiveId ? "hive" : "whatsapp")}
          disabled={enviando || !sugestoes}
          className={appDisponivel ? botaoSecundario : botaoPrimario}
        >
          Mandar no WhatsApp
        </button>
      </div>
    </div>
  );
}

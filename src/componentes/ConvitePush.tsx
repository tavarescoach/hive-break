"use client";

import { useState, useSyncExternalStore } from "react";
import { botaoPrimario, botaoSecundario, cartao } from "@/componentes/estilos";
import { horaCurta } from "@/dominio/lembretes";
import { ativarPushNesteAparelho, pushSuportado } from "@/lib/push-navegador";

/**
 * Logo depois do 1º desafio concluído: "Te aviso amanhã às {hora}?".
 * Aparece só se o navegador ainda não perguntou e a pessoa não dispensou.
 */
const CHAVE = "hive-break:push-perguntado";
const semAssinatura = () => () => {};

function deveMostrar(): boolean {
  if (!pushSuportado() || Notification.permission !== "default") return false;
  try {
    return !window.localStorage.getItem(CHAVE);
  } catch {
    return true;
  }
}

function lembrarQuePerguntou() {
  try {
    window.localStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // Sem armazenamento: pode perguntar de novo depois.
  }
}

export function ConvitePush() {
  const mostrar = useSyncExternalStore(semAssinatura, deveMostrar, () => false);
  const hora = useSyncExternalStore(semAssinatura, () => horaCurta(new Date()), () => "");
  const [estado, setEstado] = useState<"pergunta" | "ativando" | "ok" | "negado" | "fechado">("pergunta");

  if (!mostrar || estado === "fechado") return null;

  const aceitar = async () => {
    setEstado("ativando");
    lembrarQuePerguntou();
    const r = await ativarPushNesteAparelho();
    setEstado(r === "ok" ? "ok" : r === "negado" ? "negado" : "fechado");
  };

  return (
    <section className={`${cartao} border-mel/50`} aria-live="polite">
      {estado === "ok" ? (
        <p className="text-lg font-black">Combinado. Amanhã às {hora} eu te chamo 🐝</p>
      ) : estado === "negado" ? (
        <p className="text-[15px] leading-relaxed text-apagado">
          Sem problema. Se mudar de ideia, libere as notificações do Hive Break nas configurações do celular.
        </p>
      ) : (
        <>
          <p className="text-lg font-black">Te aviso amanhã às {hora}?</p>
          <p className="mt-1 text-[15px] leading-relaxed text-apagado">
            Um lembrete curto no horário em que você treinou hoje. Dá para desativar quando quiser.
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <button onClick={aceitar} disabled={estado === "ativando"} className={botaoPrimario}>
              Pode avisar
            </button>
            <button
              onClick={() => {
                lembrarQuePerguntou();
                setEstado("fechado");
              }}
              className={botaoSecundario}
            >
              Agora não
            </button>
          </div>
        </>
      )}
    </section>
  );
}

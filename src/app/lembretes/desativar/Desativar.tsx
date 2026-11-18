"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { desativarPorToken } from "@/app/lembretes/acoes";
import { botaoPrimario, botaoSecundario, sobrelinha } from "@/componentes/estilos";
import { ROTULO_CATEGORIA } from "@/dominio/lembretes";

/**
 * Desativa ao abrir a página, no navegador (filtros de e-mail que só "visitam"
 * o link não desligam nada por engano).
 */
export function Desativar({ token }: { token: string }) {
  const [estado, setEstado] = useState<{ ok: boolean; categoria?: string } | null>(token ? null : { ok: false });
  const [pendente, iniciar] = useTransition();
  const feito = useRef(false);

  useEffect(() => {
    if (!token || feito.current) return;
    feito.current = true;
    void desativarPorToken(token, false).then(setEstado, () => setEstado({ ok: false }));
  }, [token]);

  if (!estado) return <p className="text-lg text-apagado">Desativando…</p>;

  if (!estado.ok) {
    return (
      <>
        <p className={sobrelinha}>Lembretes</p>
        <h1 className="text-3xl font-black leading-tight">Esse link não vale mais</h1>
        <p className="text-base leading-relaxed text-apagado">
          Entre no app e desative os lembretes em Perfil, Configurações.
        </p>
        <Link href="/perfil/config" className={botaoPrimario}>
          Abrir configurações
        </Link>
      </>
    );
  }

  const todos = estado.categoria === "todos";
  return (
    <>
      <p className={sobrelinha}>Lembretes</p>
      <h1 className="text-3xl font-black leading-tight">
        {todos ? "Todos os lembretes desativados" : `Lembretes de ${ROTULO_CATEGORIA[estado.categoria ?? ""] ?? "este tipo"} desativados`}
      </h1>
      <p className="text-base leading-relaxed text-apagado">
        {todos
          ? "Você não vai receber mais e-mails nem notificações da Hive Break. Quando quiser, é só abrir o app."
          : "Os outros avisos continuam. Dá para mudar tudo em Perfil, Configurações."}
      </p>
      {!todos && (
        <button
          onClick={() => iniciar(async () => setEstado(await desativarPorToken(token, true)))}
          disabled={pendente}
          className={botaoSecundario}
        >
          Desativar todos
        </button>
      )}
      <Link href="/trilha" className={botaoPrimario}>
        Fazer um break agora
      </Link>
    </>
  );
}

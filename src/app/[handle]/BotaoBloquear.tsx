"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { bloquearUsuario } from "@/app/(app)/amigos/buscar/acoes";

/** Bloquear (docs/PERFIL.md, seção 2.2): a pessoa some das suas listas e você das dela. */
export function BotaoBloquear({ alvoId }: { alvoId: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const bloquear = () => {
    if (!window.confirm("Bloquear esta pessoa? Vocês deixam de se ver nas buscas, listas e feed.")) return;
    iniciar(async () => {
      const r = await bloquearUsuario(alvoId);
      if (r.ok) router.push("/amigos");
    });
  };

  return (
    <button onClick={bloquear} disabled={pendente} className="text-sm text-apagado underline underline-offset-4 disabled:opacity-50">
      Bloquear
    </button>
  );
}

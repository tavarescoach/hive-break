"use client";

import { useState, useTransition } from "react";
import { dispararTeste } from "@/app/lembretes/acoes";
import { botaoPrimario, campoTexto } from "@/componentes/estilos";

export function Disparar({ gatilhos }: { gatilhos: string[] }) {
  const [gatilho, setGatilho] = useState(gatilhos[0] ?? "A1");
  const [mensagem, setMensagem] = useState("");
  const [pendente, iniciar] = useTransition();

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda p-4">
      <h2 className="text-xl font-black">Disparar para mim</h2>
      <p className="text-sm text-apagado">
        Vai pelo n8n, com os seus dados e valores de exemplo, ignorando limites e preferências.
      </p>
      <select value={gatilho} onChange={(e) => setGatilho(e.target.value)} className={campoTexto} aria-label="Gatilho">
        {gatilhos.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <button
        className={botaoPrimario}
        disabled={pendente}
        onClick={() => iniciar(async () => setMensagem((await dispararTeste(gatilho)).mensagem))}
      >
        {pendente ? "Enviando…" : "Disparar"}
      </button>
      {mensagem && (
        <p role="status" className="text-sm">
          {mensagem}
        </p>
      )}
    </section>
  );
}

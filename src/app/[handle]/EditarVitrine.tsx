"use client";

import { useState, useTransition } from "react";
import { botaoPrimario, botaoSecundario } from "@/componentes/estilos";
import type { ProgressoConquista } from "@/dominio/conquistas";
import { definirVitrine } from "./acoes";

/** Edição da vitrine (docs/PERFIL.md, seção 3.2): até 3, entre as já conquistadas. */
export function EditarVitrine({ conquistadas, vitrineAtual }: { conquistadas: ProgressoConquista[]; vitrineAtual: string[] }) {
  const [aberto, setAberto] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>(vitrineAtual);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="text-sm font-bold text-mel underline underline-offset-4">
        Editar vitrine
      </button>
    );
  }

  const alternar = (id: string) => {
    setSelecionadas((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= 3) return atual;
      return [...atual, id];
    });
  };

  const salvar = () => {
    iniciar(async () => {
      const r = await definirVitrine(selecionadas);
      if (r.ok) setAberto(false);
      else setErro(r.erro ?? "Não consegui salvar.");
    });
  };

  if (conquistadas.length === 0) {
    return <p className="text-sm text-apagado">Conclua desafios e convide amigos para ganhar conquistas e montar a sua vitrine.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-apagado">Escolha até 3 ({selecionadas.length}/3)</p>
      <ul className="flex flex-col gap-1.5">
        {conquistadas.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-borda px-3 py-1.5 has-[:checked]:border-mel">
              <input
                type="checkbox"
                checked={selecionadas.includes(c.id)}
                onChange={() => alternar(c.id)}
                className="h-5 w-5 shrink-0 accent-[var(--color-mel)]"
              />
              <span className="text-sm font-semibold">{c.nome}</span>
            </label>
          </li>
        ))}
      </ul>
      {erro && <p role="alert" className="text-sm text-apagado">{erro}</p>}
      <div className="flex gap-2">
        <button onClick={salvar} disabled={pendente} className={`${botaoPrimario} h-11 text-sm`}>
          Salvar
        </button>
        <button onClick={() => setAberto(false)} disabled={pendente} className={`${botaoSecundario} h-11 text-sm`}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

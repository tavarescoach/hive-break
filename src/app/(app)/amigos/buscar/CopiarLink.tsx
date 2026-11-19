"use client";

import { useState } from "react";

/** Copiar/compartilhar o link do perfil (docs/PERFIL.md, seção 4.2). */
export function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem acesso à área de transferência: o link continua visível na tela.
    }
  };

  const compartilhar = async () => {
    if (!navigator.share) return copiar();
    try {
      await navigator.share({ text: `Me siga no Hive Break: ${link}` });
    } catch {
      // A pessoa fechou o menu de compartilhar.
    }
  };

  return (
    <div className="mt-2 flex gap-2">
      <button onClick={compartilhar} className="h-9 rounded-lg border border-borda px-3 text-sm font-bold">
        WhatsApp
      </button>
      <button onClick={copiar} className="h-9 rounded-lg border border-borda px-3 text-sm font-bold">
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}

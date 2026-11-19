"use client";

import { useState } from "react";
import { botaoPrimario } from "@/componentes/estilos";

/** Compartilhar perfil (docs/PERFIL.md, seção 5): Web Share API, com cópia como alternativa. */
export function CompartilharPerfil({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  const compartilhar = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Hive Break", text: "Me siga no Hive Break!", url: link });
      } catch {
        // A pessoa fechou o menu de compartilhar.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem área de transferência: ao menos o link já está na tela em algum lugar.
    }
  };

  return (
    <button onClick={compartilhar} className={botaoPrimario}>
      {copiado ? "Link copiado" : "Compartilhar perfil"}
    </button>
  );
}

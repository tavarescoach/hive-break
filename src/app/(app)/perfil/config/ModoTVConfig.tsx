"use client";

import { useSyncExternalStore } from "react";
import { cartao } from "@/componentes/estilos";
import { assinarModoTV, definirModoTV, giroAtual, type GiroTV } from "@/lib/modo-tv";

const OPCOES: { valor: GiroTV; rotulo: string }[] = [
  { valor: "0", rotulo: "Desligado" },
  { valor: "270", rotulo: "Girar 270°" },
  { valor: "90", rotulo: "Girar 90°" },
];

/**
 * Modo TV (src/lib/modo-tv.ts): para espelhar numa TV presa em pé na parede. Vale só neste
 * aparelho e, no iPhone, separadamente no Safari e no app salvo na tela de início.
 */
export function ModoTVConfig() {
  // No servidor não há escolha (null); no aparelho, lê do <html> e atualiza a cada troca.
  const giro = useSyncExternalStore<GiroTV | null>(assinarModoTV, giroAtual, () => null);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-modo-tv">
      <h2 id="titulo-modo-tv" className="text-xl font-black">
        Modo TV
      </h2>
      <div className={`${cartao} flex flex-col gap-3`}>
        <p className="text-sm leading-relaxed text-apagado">
          Para espelhar o celular numa TV presa em pé na parede. Ligado, com o celular deitado o app gira para aparecer em pé na TV. Com o
          celular em pé, nada muda. Se ficar de cabeça para baixo na TV, use o outro giro.
        </p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Modo TV">
          {OPCOES.map((o) => {
            const ativo = giro === o.valor;
            return (
              <button
                key={o.valor}
                type="button"
                aria-pressed={ativo}
                onClick={() => definirModoTV(o.valor)}
                className={`h-12 rounded-xl border px-2 text-sm font-bold ${ativo ? "border-mel bg-mel text-black" : "border-borda bg-superficie-2 text-texto"}`}
              >
                {o.rotulo}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-apagado">Vale só neste aparelho. No iPhone, o app da tela de início e o Safari guardam a escolha separadamente.</p>
      </div>
    </section>
  );
}

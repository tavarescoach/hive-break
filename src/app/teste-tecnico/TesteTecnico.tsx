"use client";

import { useCallback, useState } from "react";
import { Conferencia } from "./Conferencia";
import { Escolha } from "./Escolha";
import { TelaTeste } from "./TelaTeste";
import type { ConfigTeste, ResultadoTeste } from "./tipos";

type Tela =
  | { tipo: "escolha" }
  | { tipo: "execucao"; config: ConfigTeste; tentativa: number }
  | { tipo: "conferencia"; resultado: ResultadoTeste };

export function TesteTecnico() {
  const [tela, setTela] = useState<Tela>({ tipo: "escolha" });

  const comecar = useCallback((config: ConfigTeste) => {
    // `tentativa` muda a cada início para a tela da câmera recomeçar do zero.
    setTela({ tipo: "execucao", config, tentativa: Date.now() });
  }, []);
  const voltar = useCallback(() => setTela({ tipo: "escolha" }), []);
  const aoFim = useCallback((resultado: ResultadoTeste) => setTela({ tipo: "conferencia", resultado }), []);

  if (tela.tipo === "execucao") {
    return <TelaTeste key={tela.tentativa} config={tela.config} aoFim={aoFim} aoSair={voltar} />;
  }
  if (tela.tipo === "conferencia") {
    return <Conferencia resultado={tela.resultado} aoRepetir={comecar} aoVoltar={voltar} />;
  }
  return <Escolha aoComecar={comecar} />;
}

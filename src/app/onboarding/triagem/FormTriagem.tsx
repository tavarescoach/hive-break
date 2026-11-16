"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar } from "@/componentes/BotaoEnviar";
import { botaoPrimario, cartao } from "@/componentes/estilos";
import { AVISO_MEDICO } from "@/dominio/termos";
import { PERGUNTAS_TRIAGEM } from "@/dominio/triagem";
import { salvarTriagem } from "../acoes";

const opcao =
  "flex h-12 cursor-pointer items-center justify-center rounded-xl border border-borda bg-fundo text-base font-bold has-[:checked]:border-mel has-[:checked]:bg-mel has-[:checked]:text-black has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-mel";

export function FormTriagem() {
  const [estado, enviar] = useActionState(salvarTriagem, {});

  if (estado.recomendacao) {
    return (
      <div role="status" className="flex flex-1 flex-col gap-4">
        <div className={`${cartao} border-atencao/60`}>
          <p className="text-xl font-black leading-tight">Converse com um médico antes de treinos intensos</p>
          <p className="mt-2 text-[15px] leading-relaxed text-apagado">
            Pelo que você respondeu, o mais seguro é pedir liberação médica antes de fazer força, condicionamento ou
            HIIT.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed">
            Enquanto isso, você treina com desafios de baixa intensidade: mobilidade, alongamento, yoga, equilíbrio e
            respiração. Eles contam para a ofensiva do mesmo jeito.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-apagado">
            Quando for liberado, avise no seu perfil para destravar os outros desafios. {AVISO_MEDICO}
          </p>
        </div>
        <Link href="/onboarding" className={`${botaoPrimario} mt-auto`}>
          Entendi, continuar
        </Link>
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-1 flex-col">
      <ol className="flex flex-col gap-3">
        {PERGUNTAS_TRIAGEM.map((pergunta, i) => (
          <li key={pergunta.id}>
            <fieldset className={cartao}>
              <legend className="float-left mb-3 w-full text-base font-semibold leading-snug">
                <span className="text-mel">{i + 1}.</span> {pergunta.texto}
              </legend>
              <div className="clear-both grid grid-cols-2 gap-2">
                <label className={opcao}>
                  <input type="radio" name={pergunta.id} value="nao" required className="sr-only" />
                  Não
                </label>
                <label className={opcao}>
                  <input type="radio" name={pergunta.id} value="sim" required className="sr-only" />
                  Sim
                </label>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="sticky bottom-0 -mx-5 mt-6 bg-gradient-to-t from-fundo from-75% to-transparent px-5 pb-2 pt-6">
        {estado.erro && (
          <p role="alert" className="mb-3 rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">
            {estado.erro}
          </p>
        )}
        <BotaoEnviar>Continuar</BotaoEnviar>
      </div>
    </form>
  );
}

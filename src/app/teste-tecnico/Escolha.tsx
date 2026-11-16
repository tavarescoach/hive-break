"use client";

import { useState, useSyncExternalStore } from "react";
import type { ModeloPose } from "@/camera/pose";
import { prepararSom } from "@/camera/som";
import { EXERCICIOS } from "@/exercicios";
import { dentroDaTolerancia, historico, resumirPorExercicio, textoDoHistorico } from "./historico";
import { ehSustentacao, type ConfigTeste } from "./tipos";

const METAS_REPS = [10, 12, 20, 0];
const METAS_TEMPO = [20, 30, 45, 0];

function Opcoes<T extends string | number>({
  legenda,
  valor,
  opcoes,
  aoMudar,
}: {
  legenda: string;
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (valor: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-apagado">{legenda}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-2">
        {opcoes.map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            aria-pressed={o.valor === valor}
            onClick={() => aoMudar(o.valor)}
            className={`h-12 rounded-xl border text-base font-bold ${
              o.valor === valor ? "border-mel bg-mel text-black" : "border-borda bg-superficie text-texto active:bg-superficie-2"
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Escolha({ aoComecar }: { aoComecar: (config: ConfigTeste) => void }) {
  const [id, setId] = useState(EXERCICIOS[0].id);
  const [metaReps, setMetaReps] = useState(12);
  const [metaTempo, setMetaTempo] = useState(30);
  const [modelo, setModelo] = useState<ModeloPose>("lite");
  const [gravar, setGravar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const registros = useSyncExternalStore(historico.assinar, historico.atual, historico.noServidor);

  const def = EXERCICIOS.find((e) => e.id === id)!;
  const sustentacao = ehSustentacao(def);
  const meta = sustentacao ? metaTempo : metaReps;
  const resumo = resumirPorExercicio(registros);

  const comecar = () => {
    prepararSom();
    aoComecar({ def, meta, modelo, gravar });
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoDoHistorico(registros));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem acesso à área de transferência.
    }
  };

  return (
    <main className="flex min-h-dvh flex-col gap-7 px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mel">Hive Break · Fase 0</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">Teste técnico da câmera</h1>
        <p className="mt-2 text-base leading-relaxed text-apagado">
          Faça o exercício, conte as repetições em voz alta e compare com o que a câmera contou. A meta é errar no
          máximo 1 a cada 10.
        </p>
      </header>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-apagado">Exercício</legend>
        <div className="flex flex-col gap-2">
          {EXERCICIOS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={e.id === id}
              onClick={() => setId(e.id)}
              className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                e.id === id ? "border-mel bg-mel/10" : "border-borda bg-superficie active:bg-superficie-2"
              }`}
            >
              <span className="text-lg font-bold">{e.nome}</span>
              <span className="text-sm text-apagado">{ehSustentacao(e) ? "por tempo" : "por repetições"}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {sustentacao ? (
        <Opcoes
          legenda="Meta de tempo"
          valor={metaTempo}
          aoMudar={setMetaTempo}
          opcoes={METAS_TEMPO.map((v) => ({ valor: v, rotulo: v === 0 ? "Livre" : `${v} s` }))}
        />
      ) : (
        <Opcoes
          legenda="Meta de repetições"
          valor={metaReps}
          aoMudar={setMetaReps}
          opcoes={METAS_REPS.map((v) => ({ valor: v, rotulo: v === 0 ? "Livre" : String(v) }))}
        />
      )}

      <section className="rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="text-base font-bold">Como posicionar</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-apagado">
          <li>Apoie o celular em pé num móvel, na altura da cintura, a 2 ou 3 metros.</li>
          {def.instrucoes?.map((linha) => <li key={linha}>{linha}</li>)}
          <li>A contagem começa sozinha 5 segundos depois que seu corpo inteiro aparecer.</li>
        </ul>
      </section>

      <details className="rounded-2xl border border-borda bg-superficie p-4">
        <summary className="cursor-pointer text-base font-bold">Opções de teste</summary>
        <div className="mt-4 flex flex-col gap-4">
          <Opcoes
            legenda="Modelo de pose"
            valor={modelo}
            aoMudar={setModelo}
            opcoes={[
              { valor: "lite", rotulo: "Leve (padrão)" },
              { valor: "full", rotulo: "Completo" },
            ]}
          />
          <label className="flex min-h-12 items-start gap-3">
            <input
              type="checkbox"
              checked={gravar}
              onChange={(e) => setGravar(e.target.checked)}
              className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-mel)]"
            />
            <span className="text-[15px] leading-relaxed">
              <span className="font-semibold">Gravar os pontos do corpo desta tentativa</span>
              <span className="block text-apagado">
                Guarda só as coordenadas do esqueleto (sem imagem) para você baixar no fim e me enviar. Serve para
                calibrar a contagem. Nada é enviado sozinho.
              </span>
            </span>
          </label>
        </div>
      </details>

      <div className="sticky bottom-0 z-10 -mx-5 bg-gradient-to-t from-fundo from-70% to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <button onClick={comecar} className="h-14 w-full rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte">
          Abrir câmera e começar
        </button>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Conferências neste aparelho</h2>
          {registros.length > 0 && (
            <div className="flex gap-2">
              <button onClick={copiar} className="h-12 rounded-xl border border-borda px-3 text-sm font-semibold">
                {copiado ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={() => window.confirm("Apagar o histórico deste aparelho?") && historico.limpar()}
                className="h-12 rounded-xl border border-borda px-3 text-sm font-semibold text-apagado"
              >
                Limpar
              </button>
            </div>
          )}
        </div>
        {registros.length === 0 ? (
          <p className="mt-2 text-[15px] leading-relaxed text-apagado">
            Ainda sem conferências. Ao fim de cada tentativa, informe quantas repetições você contou.
          </p>
        ) : (
          <>
            <ul className="mt-3 flex flex-col gap-2">
              {resumo.map((r) => (
                <li key={r.exercicio} className="rounded-xl border border-borda bg-superficie px-4 py-3">
                  <p className="font-bold">{r.nomeExercicio}</p>
                  <p className="text-[15px] text-apagado">
                    {r.dentro} de {r.tentativas} dentro da meta · erro médio de{" "}
                    <span className="font-semibold text-texto">
                      {r.erroNormalizado.toFixed(1).replace(".", ",")} {r.unidade === "reps" ? "a cada 10 reps" : "s a cada 60 s"}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
            <ul className="mt-3 divide-y divide-borda text-[14px]">
              {registros.slice(0, 12).map((r) => (
                <li key={r.quando} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-apagado">{r.nomeExercicio}</span>
                  <span className="tabular-nums">
                    câmera {r.motor} · você {r.manual}{" "}
                    <span className={dentroDaTolerancia(r) ? "text-bom" : "text-ruim"}>
                      {dentroDaTolerancia(r) ? "ok" : "fora"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-center text-xs leading-relaxed text-apagado">
        A câmera é processada no seu aparelho. Nenhuma imagem ou vídeo é gravado ou enviado.
      </p>
    </main>
  );
}

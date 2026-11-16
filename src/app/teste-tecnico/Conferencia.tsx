"use client";

import { useState } from "react";
import { prepararSom } from "@/camera/som";
import type { Fixture } from "@/motor/fixture";
import { dentroDaTolerancia, historico } from "./historico";
import type { ConfigTeste, ResultadoTeste } from "./tipos";

interface Props {
  resultado: ResultadoTeste;
  aoRepetir: (config: ConfigTeste) => void;
  aoVoltar: () => void;
}

const numero = (valor: number | null, casas = 0, sufixo = "") =>
  valor === null ? "—" : `${valor.toFixed(casas).replace(".", ",")}${sufixo}`;
const porcento = (valor: number | null) => (valor === null ? "—" : `${Math.round(valor * 100)}%`);

function montarFixture(resultado: ResultadoTeste, manual: number | null): Fixture {
  const { config, kpis } = resultado;
  return {
    versao: 1,
    exercicio: config.def.id,
    origem: "gravada",
    descricao: `Gravação do teste técnico em ${new Date().toISOString()} · motor contou ${resultado.contagem} ${resultado.unidade}, ${kpis.reps_parciais} parciais`,
    proporcao: Math.round(resultado.proporcao * 10000) / 10000,
    fps: resultado.fpsMedio,
    modelo: `${config.modelo}/${resultado.delegado}`,
    esperado: manual === null ? undefined : resultado.unidade === "reps" ? { reps_validas: manual } : { tempo_valido_s: manual },
    frames: resultado.gravacao ?? [],
  };
}

export function Conferencia({ resultado, aoRepetir, aoVoltar }: Props) {
  const { config, kpis, unidade, contagem } = resultado;
  const [texto, setTexto] = useState("");
  const [manual, setManual] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const reps = unidade === "reps";

  const salvar = () => {
    const valor = Number(texto.replace(",", "."));
    if (texto.trim() === "" || !Number.isFinite(valor) || valor < 0) return;
    setManual(valor);
    historico.adicionar({
      quando: new Date().toISOString(),
      exercicio: config.def.id,
      nomeExercicio: config.def.nome,
      unidade,
      motor: contagem,
      manual: valor,
      parciais: kpis.reps_parciais,
      modelo: config.modelo,
      delegado: resultado.delegado,
      fps: resultado.fpsMedio,
    });
  };

  const baixar = async () => {
    const fixture = montarFixture(resultado, manual);
    const carimbo = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const nome = `hivebreak_${config.def.id}_${carimbo}.json`;
    const arquivo = new File([JSON.stringify(fixture)], nome, { type: "application/json" });
    try {
      // No celular, abre o menu de compartilhar (WhatsApp, e-mail, Arquivos).
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nome });
        return;
      }
    } catch (erro) {
      if ((erro as DOMException).name === "AbortError") return;
    }
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    setAviso("Arquivo baixado. Procure na pasta de downloads do aparelho.");
  };

  const ok = manual !== null && dentroDaTolerancia({ unidade, motor: contagem, manual });
  const linhas: [string, string][] = reps
    ? [
        ["Repetições válidas", String(kpis.reps_validas)],
        ["Repetições parciais", String(kpis.reps_parciais)],
        ["Rápidas demais (não contam)", String(kpis.reps_rapidas)],
        ["Amplitude média", porcento(kpis.amplitude_media)],
        ["Tempo de descida", numero(kpis.tempo_excentrico, 2, " s")],
        ["Tempo de subida", numero(kpis.tempo_concentrico, 2, " s")],
        ["Cadência", numero(kpis.cadencia, 0, " reps/min")],
        ["Regularidade do ritmo", porcento(kpis.regularidade)],
        ["Índice técnico", porcento(kpis.indice_tecnico)],
      ]
    : [
        ["Tempo válido", numero(kpis.tempo_valido_s, 1, " s")],
        ["Pé esquerdo no ar", numero(kpis.tempo_valido_e_s, 1, " s")],
        ["Pé direito no ar", numero(kpis.tempo_valido_d_s, 1, " s")],
        ["Maior tempo seguido", numero(kpis.maior_sustentacao_s, 1, " s")],
        ["Vezes que saiu da posição", String(kpis.perdas_posicao)],
        ["Estabilidade", porcento(kpis.estabilidade)],
      ];
  for (const [id, vezes] of Object.entries(kpis.erros)) {
    const erro = config.def.erros?.find((e) => e.id === id);
    linhas.push([`Erro: ${erro?.feedback ?? id}`, `${vezes}x`]);
  }
  linhas.push(
    ["Tempo fora do quadro", numero(kpis.fora_quadro_pct, 0, "%")],
    ["Quadros por segundo", numero(resultado.fpsMedio, 0, " fps")],
    ["Detector", `${config.modelo} · ${resultado.delegado}`],
  );

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mel">{config.def.nome}</p>
        <h1 className="mt-2 text-3xl font-black leading-tight">A câmera contou</h1>
        <p className="mt-1 text-[5.5rem] font-black leading-none tabular-nums">
          {contagem}
          <span className="ml-2 text-2xl font-bold text-apagado">{reps ? (contagem === 1 ? "repetição" : "repetições") : "segundos"}</span>
        </p>
      </header>

      <section className="rounded-2xl border border-borda bg-superficie p-4">
        {manual === null ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvar();
            }}
          >
            <label htmlFor="manual" className="text-lg font-bold">
              {reps ? "Quantas repetições você contou?" : "Quantos segundos você ficou com o pé no ar?"}
            </label>
            <p className="mt-1 text-[15px] text-apagado">
              {reps ? "Conte só as completas, do jeito que um treinador contaria." : "Use um cronômetro ou conte em voz alta."}
            </p>
            <div className="mt-3 flex gap-2">
              <input
                id="manual"
                inputMode="decimal"
                autoComplete="off"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="h-14 min-w-0 flex-1 rounded-xl border border-borda bg-fundo px-4 text-2xl font-bold tabular-nums"
              />
              <button type="submit" className="h-14 rounded-xl bg-mel px-6 text-lg font-bold text-black active:bg-mel-forte">
                Conferir
              </button>
            </div>
          </form>
        ) : (
          <div role="status">
            <p className={`text-2xl font-black ${ok ? "text-bom" : "text-ruim"}`}>
              {contagem === manual ? "Contagem exata" : ok ? "Dentro da meta" : "Fora da meta"}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-apagado">
              Câmera: {contagem} · Você: {String(manual).replace(".", ",")} · Diferença:{" "}
              {String(Math.abs(contagem - manual)).replace(".", ",")} {reps ? "rep" : "s"}. Meta:{" "}
              {reps ? "até 1 a cada 10 repetições" : "até 2 s a cada 60 s"}. Salvo no histórico deste aparelho.
            </p>
          </div>
        )}
      </section>

      {resultado.gravacao && (
        <section className="rounded-2xl border border-borda bg-superficie p-4">
          <h2 className="text-lg font-bold">Gravação dos pontos do corpo</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-apagado">
            {resultado.gravacao.length} quadros de coordenadas, sem imagem.
            {resultado.gravacaoCortada ? " A gravação parou aos 90 s." : ""}
            {manual === null ? " Informe sua contagem acima antes de baixar, para ela ir junto no arquivo." : ""}
          </p>
          <button onClick={baixar} className="mt-3 h-14 w-full rounded-xl border border-mel text-lg font-bold text-mel active:bg-mel/10">
            Baixar ou compartilhar arquivo
          </button>
          {aviso && (
            <p role="status" className="mt-2 text-[15px] text-apagado">
              {aviso}
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="text-base font-bold">Números do bloco</h2>
        <dl className="mt-2 divide-y divide-borda text-[15px]">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-apagado">{rotulo}</dt>
              <dd className="font-semibold tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-auto flex flex-col gap-3">
        <button
          onClick={() => {
            prepararSom();
            aoRepetir(config);
          }}
          className="h-14 rounded-2xl bg-mel text-lg font-black text-black active:bg-mel-forte"
        >
          Repetir este exercício
        </button>
        <button onClick={aoVoltar} className="h-14 rounded-2xl border border-borda text-lg font-bold active:bg-superficie">
          Escolher outro
        </button>
      </div>
    </main>
  );
}

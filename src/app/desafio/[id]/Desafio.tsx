"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { prepararSom } from "@/camera/som";
import { ConvitePush } from "@/componentes/ConvitePush";
import { botaoPrimario, botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { Gabarito, dicaDoGabarito } from "@/componentes/Gabarito";
import type { BlocoEnviado } from "@/dominio/agregar";
import {
  compilar, converterMetodoAntigo, descreverBloco, descreverScore, estruturaLegada, etiquetasDoBloco, explicarCadencia,
  formatarTempo, GLOSSARIO,
  type Estrutura, type ExercicioMetodo, type LinhaDoTempo, type LinhaSerie, type MetodoAntigo, type ResultadoFase, type ResumoMetodo,
} from "@/dominio/metodos";
import { ROTULO_EQUIPAMENTO, ROTULO_MODALIDADE } from "@/dominio/trilha";
import { montarDadosCard, type RecordesAnteriores } from "@/dominio/card";
import { Compartilhar } from "@/compartilhar/Compartilhar";
import { exercicioPorId, paraMetodo } from "@/exercicios";
import { registrarResultadoHive } from "@/app/hive/acoes";
import { useHive } from "@/app/hive/AoVivo";
import { CardColetivo } from "@/app/hive/CardColetivo";
import { finalizarDesafio, registrarEsforco, type ResultadoDesafio } from "./acoes";
import { Execucao } from "./Execucao";

export interface BlocoDesafio {
  ordem: number;
  exercicioId: string;
  exercicio: string;
  lateral: boolean;
  segundos: number;
}

interface Props {
  id: string;
  titulo: string;
  modalidade: string;
  contexto: string;
  xp: number;
  equipamento: string | null;
  jaFeito: boolean;
  blocos: BlocoDesafio[];
  /** Blocos com as variáveis metodológicas (migração 0009). */
  estrutura: Estrutura | null;
  /** Formato anterior (migração 0008), convertido para blocos quando não há estrutura. */
  metodoAntigo: MetodoAntigo | null;
  /** Segundos da contagem do pop-up "PREPARE-SE". */
  preparoS: number;
  /** Identificação no card de compartilhamento. */
  usuario: string;
  instagram: string | null;
  /** Melhores marcas anteriores neste desafio (com câmera). null: não deu para ler. */
  recordes: RecordesAnteriores | null;
}

type Etapa = "pronto" | "camera" | "manual";

export interface FimDoDesafio {
  numeros: BlocoEnviado[];
  resumo: ResumoMetodo;
  porSerie: LinhaSerie[];
  /** Resultado de cada série, para o card de compartilhamento. */
  resultados: ResultadoFase[];
}

export function Desafio(props: Props) {
  const { id, titulo, modalidade, contexto, xp, equipamento, jaFeito, blocos, preparoS } = props;
  const { linha, exercicios } = useMemo(() => {
    const ex: ExercicioMetodo[] = blocos.map((b) => {
      const def = exercicioPorId(b.exercicioId);
      return def ? paraMetodo(def) : { nome: b.exercicio, sustentacao: false, segPorRep: 3, lateral: b.lateral };
    });
    const ids = blocos.map((b) => b.exercicioId);
    const estrutura =
      props.estrutura ??
      (props.metodoAntigo ? converterMetodoAntigo(props.metodoAntigo, ids, ex) : estruturaLegada(ids, blocos.map((b) => b.segundos), ex));
    return { linha: compilar(estrutura, ex, { preparoS }), exercicios: ex };
  }, [blocos, props.estrutura, props.metodoAntigo, preparoS]);
  const [etapa, setEtapa] = useState<Etapa>("pronto");
  const [avisoCamera, setAvisoCamera] = useState<string | null>(null);
  const [glossario, setGlossario] = useState(false);
  const [resultado, setResultado] = useState<ResultadoDesafio | null>(null);
  const [envio, setEnvio] = useState<(FimDoDesafio & { modo: "camera" | "manual" }) | null>(null);
  const [enviando, iniciar] = useTransition();
  const hive = useHive();
  const voltar = hive ? "/hive" : "/trilha";

  const finalizar = (modo: "camera" | "manual", fim: FimDoDesafio) => {
    setEnvio({ modo, ...fim });
    hive?.publicar({ etapa: "terminou" });
    iniciar(async () => {
      const r = await finalizarDesafio(id, modo, fim.numeros);
      // Hive: leva o resultado gravado pelo servidor para o card coletivo.
      if (r.ok && hive) await registrarResultadoHive(hive.hiveId);
      setResultado(r);
    });
  };

  if (resultado?.ok && envio) {
    const pseAlvo = linha.estrutura.blocos.map((b) => b.pse_alvo).filter((v): v is number => v !== undefined);
    return (
      <Resultado
        id={id}
        resultado={resultado}
        fim={envio}
        nomes={blocos.map((b) => b.exercicio)}
        pseAlvo={pseAlvo.length ? Math.max(...pseAlvo) : null}
        linha={linha}
        modo={envio.modo}
        card={{ titulo, modalidade: ROTULO_MODALIDADE[modalidade] ?? modalidade, usuario: props.usuario, instagram: props.instagram, recordes: props.recordes }}
      />
    );
  }

  // O desafio terminou mas o envio falhou: deixa tentar de novo sem refazer.
  if (envio && (enviando || resultado?.erro)) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-5 px-5">
        <h1 className="text-2xl font-black">{enviando ? "Registrando seu desafio…" : "Não consegui registrar"}</h1>
        {resultado?.erro && <p role="alert" className="text-base leading-relaxed text-apagado">{resultado.erro}</p>}
        {!enviando && (
          <>
            <button onClick={() => finalizar(envio.modo, envio)} className={botaoPrimario}>Tentar de novo</button>
            <Link href={voltar} className={botaoSecundario}>{hive ? "Voltar para a hive" : "Voltar para a trilha"}</Link>
          </>
        )}
      </main>
    );
  }

  if (etapa !== "pronto") {
    return (
      <Execucao
        key={etapa}
        id={id}
        blocos={blocos}
        exercicios={exercicios}
        linha={linha}
        comCamera={etapa === "camera"}
        aoFim={(fim) => finalizar(etapa === "camera" ? "camera" : "manual", fim)}
        aoSemCamera={(mensagem) => {
          setAvisoCamera(mensagem);
          setEtapa("pronto");
        }}
      />
    );
  }

  const detalhe = [
    ROTULO_MODALIDADE[modalidade] !== titulo ? ROTULO_MODALIDADE[modalidade] : null,
    formatarTempo(linha.duracaoEstimadaS),
    `+${xp} XP`,
    equipamento ? ROTULO_EQUIPAMENTO[equipamento] : null,
  ].filter(Boolean).join(" · ");
  const alternada = linha.estrutura.organizacao === "alternada" && blocos.length > 1;

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-start gap-2">
        <Link href={voltar} aria-label={hive ? "Sair da hive" : "Voltar para a trilha"} className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-apagado active:bg-superficie">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <div className="min-w-0 pt-1">
          <p className="truncate text-[12px] font-black uppercase tracking-[0.12em] text-apagado">{contexto}</p>
          <h1 className="text-2xl font-black leading-tight">{titulo}</h1>
          <p className="text-sm text-apagado">{detalhe}</p>
          {hive && (
            <p className="mt-1 text-sm font-bold text-mel">
              Hive · {hive.colegas.length + 1} hiving{hive.competicao ? " · modo competição" : ""}
            </p>
          )}
        </div>
      </header>

      <section className="mt-4">
        <PrevisaoFases linha={linha} />
        <p className="mt-2 text-[13px] leading-snug text-apagado">
          {alternada
            ? `Os exercícios se alternam a cada série${linha.estrutura.pausa_entre_blocos_s ? `, com ${linha.estrutura.pausa_entre_blocos_s} s de pausa ao fim de cada rodada` : ""}.`
            : blocos.length > 1
              ? `Um exercício de cada vez${linha.estrutura.pausa_entre_blocos_s ? `, com ${linha.estrutura.pausa_entre_blocos_s} s de pausa entre eles` : ""}.`
              : null}
          {linha.estrutura.teto_s ? ` Teto de ${formatarTempo(linha.estrutura.teto_s)}.` : ""}
        </p>
      </section>

      <section className="mt-4 flex-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Exercícios</h2>
          <button onClick={() => setGlossario((v) => !v)} aria-expanded={glossario} className="h-10 rounded-full px-3 text-sm font-bold text-mel underline underline-offset-4">
            {glossario ? "Fechar" : "O que é isso?"}
          </button>
        </div>
        {glossario && (
          <dl className={`${cartao} mt-2 flex flex-col gap-1.5 text-[14px] leading-snug`}>
            {GLOSSARIO.map((g) => (
              <div key={g.termo}>
                <dt className="inline font-bold">{g.termo}: </dt>
                <dd className="inline text-apagado">{g.texto}</dd>
              </div>
            ))}
          </dl>
        )}
        <ol className="mt-3 flex flex-col gap-2.5">
          {linha.estrutura.blocos.map((bloco, i) => {
            const b = blocos[i];
            return (
              <li key={b.ordem} className={`${cartao} flex gap-3 py-3`}>
                <Gabarito exercicio={b.exercicioId} tamanho={76} className="shrink-0 self-start rounded-xl bg-fundo" />
                <div className="min-w-0 flex-1">
                  <p className="font-black leading-tight">{b.exercicio}</p>
                  <p className="mt-0.5 text-[15px] font-bold leading-snug text-mel">{descreverBloco(bloco, exercicios[i])}</p>
                  <p className="text-sm font-semibold text-texto">{descreverScore(bloco)}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {etiquetasDoBloco(bloco).map((e) => (
                      <li key={e.rotulo} className="rounded-full border border-borda bg-fundo px-2 py-0.5 text-[12px] font-semibold">
                        <span className="text-apagado">{e.rotulo}</span> {e.valor}
                      </li>
                    ))}
                  </ul>
                  {bloco.cadencia && <p className="mt-1 text-[13px] text-apagado">Cadência: {explicarCadencia(bloco.cadencia)}.</p>}
                  <p className="mt-1 text-[13px] leading-snug text-apagado">{dicaDoGabarito(b.exercicioId)}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {avisoCamera && (
          <p role="alert" className={`${cartao} mt-4 border-atencao/60 text-[15px] leading-relaxed`}>
            {avisoCamera} Você pode fazer sem câmera: o timer conduz e você confirma as repetições (metade do XP).
          </p>
        )}
        <p className="mt-4 text-[15px] leading-relaxed text-apagado">
          A câmera conta as repetições e confere a execução. O vídeo é analisado no seu aparelho: nenhuma imagem é gravada ou enviada.
          {jaFeito ? " Você já fez este desafio: refazer vale 1/3 do XP, uma vez por dia." : ""}
        </p>
      </section>

      <div className="sticky bottom-0 -mx-5 mt-4 flex flex-col gap-3 bg-gradient-to-t from-fundo from-80% to-transparent px-5 pt-6">
        <button
          onClick={() => {
            prepararSom();
            setAvisoCamera(null);
            setEtapa("camera");
          }}
          className={botaoPrimario}
        >
          Começar com a câmera
        </button>
        <button
          onClick={() => {
            prepararSom();
            setEtapa("manual");
          }}
          className={botaoSecundario}
        >
          Fazer sem câmera (metade do XP)
        </button>
      </div>
    </main>
  );
}

/** Faixa colorida com as fases do desafio: esforço em amarelo, pausa em cinza. */
function PrevisaoFases({ linha }: { linha: ReturnType<typeof compilar> }) {
  const fases = linha.fases.filter((f, i) => !(f.tipo === "preparo" && i === 0));
  const peso = (f: (typeof fases)[number]) => (f.tipo === "trabalho" ? (f.duracaoMs ?? 20_000) : f.duracaoMs);
  const total = fases.reduce((s, f) => s + peso(f), 0) || 1;
  return (
    <div aria-hidden>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-superficie-2">
        {fases.map((f, i) => (
          <span
            key={i}
            className={f.tipo === "trabalho" ? "bg-mel" : f.tipo === "descanso" ? "bg-[#5A5E68]" : "bg-[#F5F2EA]/70"}
            style={{ width: `${(100 * peso(f)) / total}%`, borderRight: "2px solid #0d0e11" }}
          />
        ))}
      </div>
      <p className="mt-1.5 flex gap-4 text-xs font-semibold text-apagado">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-mel align-middle" />esforço</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#5A5E68] align-middle" />pausa</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#F5F2EA]/70 align-middle" />prepare-se</span>
      </p>
    </div>
  );
}

interface InfoCard {
  titulo: string;
  modalidade: string;
  usuario: string;
  instagram: string | null;
  recordes: RecordesAnteriores | null;
}

function Resultado({
  id, resultado, fim, nomes, pseAlvo, linha, card, modo,
}: {
  id: string;
  resultado: ResultadoDesafio;
  fim: FimDoDesafio;
  nomes: string[];
  pseAlvo: number | null;
  linha: LinhaDoTempo;
  card: InfoCard;
  modo: "camera" | "manual";
}) {
  const hive = useHive();
  const [pse, setPse] = useState<number | null>(null);
  const [compartilhando, setCompartilhando] = useState(false);
  // Hora em que o treino terminou (fica fixa enquanto a pessoa monta o card).
  const [quando] = useState(() => new Date());
  // Na hive: total anônimo de quem já terminou (eu incluso). Fora dela, o item some.
  const hiveFizeram = hive ? 1 + hive.colegas.filter((c) => c.etapa === "terminou").length : 0;
  const hiveTotal = hive ? 1 + hive.colegas.length : 0;
  const dadosCard = useMemo(
    () =>
      montarDadosCard({
        linha,
        resultados: fim.resultados,
        nomes,
        ofensiva: resultado.ofensiva ?? 1,
        // Sem câmera as séries não são guardadas: não há recorde para comparar.
        recordesAnteriores: modo === "camera" && !resultado.sem_movimento ? card.recordes : null,
        hive: hiveTotal > 0 ? { fizeram: hiveFizeram, total: hiveTotal } : null,
        pse,
        usuario: card.usuario,
        instagram: card.instagram,
        desafio: card.titulo,
        modalidade: card.modalidade,
        quando,
      }),
    [linha, fim.resultados, nomes, resultado, card, pse, quando, modo, hiveFizeram, hiveTotal],
  );
  const [salvandoPse, iniciar] = useTransition();
  const titulo = resultado.nivel_concluido ? "Seção concluída" : resultado.unidade_concluida ? "Unidade concluída" : "Desafio concluído";
  const notas: string[] = [];
  if (resultado.sem_movimento) notas.push("A câmera não viu movimento em pelo menos metade dos exercícios, então valeu como modo sem câmera (metade do XP).");
  else if (resultado.modo === "manual") notas.push("Sem câmera vale metade do XP.");
  if (resultado.refazer_sem_xp) notas.push("Você já refez este desafio hoje, então ele não soma XP de novo. O treino valeu do mesmo jeito.");
  else if (resultado.refeito) notas.push("Refazer vale 1/3 do XP, uma vez por dia.");
  if (resultado.primeiro_do_dia) notas.push("Inclui o bônus do primeiro desafio do dia.");
  if (resultado.unidade_sessao) notas.push("+50 XP por fechar a unidade numa única sessão.");
  if (resultado.nivel_concluido) notas.push(resultado.proximo_nivel ? `+30 XP pela seção. A Seção ${resultado.proximo_nivel} está liberada.` : "+30 XP: você fechou a última seção da trilha.");

  const escolherPse = (valor: number) => {
    setPse(valor);
    iniciar(async () => {
      await registrarEsforco(id, valor);
    });
  };

  if (compartilhando) return <Compartilhar dados={dadosCard} aoFechar={() => setCompartilhando(false)} />;

  return (
    <main className="flex min-h-dvh flex-col gap-4 px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
      <div role="status" className="flex flex-col items-center gap-2 text-center">
        <p className={sobrelinha}>{titulo}</p>
        <p className="text-[5rem] font-black leading-none text-mel tabular-nums">+{resultado.xp}</p>
        <p className="-mt-1 text-2xl font-black">XP</p>
      </div>

      {hive && <CardColetivo hiveId={hive.hiveId} euId={hive.eu.id} />}

      <section className={cartao}>
        <p className="text-xl font-black leading-tight">{fim.resumo.titulo}</p>
        {fim.resumo.detalhes.map((d) => (
          <p key={d} className="mt-1 text-[15px] text-apagado">{d}</p>
        ))}
      </section>

      <section className={cartao} aria-label="Esforço percebido">
        <h2 className="text-lg font-black leading-tight">Quanto foi o esforço?</h2>
        <p className="mt-0.5 text-sm text-apagado">
          De 1 (muito leve) a 10 (máximo).{pseAlvo ? ` O esperado para este desafio era ${pseAlvo}.` : ""}
        </p>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              onClick={() => escolherPse(v)}
              aria-pressed={pse === v}
              disabled={salvandoPse}
              className={`h-12 rounded-xl border text-lg font-black tabular-nums ${pse === v ? "border-mel bg-mel text-black" : "border-borda bg-fundo active:bg-superficie-2"}`}
            >
              {v}
            </button>
          ))}
        </div>
        {pse !== null && !salvandoPse && <p role="status" className="mt-2 text-sm font-semibold text-bom">Anotado: esforço {pse}.</p>}
      </section>

      {fim.porSerie.length > 0 && (
        <section>
          <h2 className="text-base font-bold">Série por série</h2>
          <ol className="mt-2 divide-y divide-borda text-[15px]">
            {fim.porSerie.map((s, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{nomes[s.exercicio]}</span>
                  <span className="block text-[13px] text-apagado">{s.rotulo}{s.meta ? ` · meta ${s.meta}` : ""}</span>
                </span>
                <span className={`shrink-0 font-bold tabular-nums ${s.cumprida ? "text-bom" : "text-atencao"}`}>
                  {s.valor} {s.cumprida ? "✓" : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {notas.length > 0 && (
        <ul className="flex flex-col gap-1 text-[15px] leading-relaxed text-apagado">
          {notas.map((nota) => <li key={nota}>{nota}</li>)}
        </ul>
      )}
      <section className={cartao}>
        <p className="text-lg font-black">
          Ofensiva: {resultado.ofensiva} {resultado.ofensiva === 1 ? "dia" : "dias"}
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-apagado">
          {resultado.unidade_concluida ? "A próxima unidade já está liberada na trilha." : "O próximo desafio já está liberado na trilha."}
        </p>
      </section>
      <ConvitePush />
      <div className="mt-auto flex flex-col gap-3">
        <Link href={hive ? "/hive" : "/trilha"} className={botaoPrimario}>
          {hive ? "Ver outras hives" : "Continuar"}
        </Link>
        <button onClick={() => setCompartilhando(true)} className={botaoSecundario}>
          Compartilhar treino
        </button>
        <Link href={hive ? "/trilha" : "/amigos"} className={botaoSecundario}>
          {hive ? "Voltar para a trilha" : "Convidar amigos"}
        </Link>
      </div>
    </main>
  );
}

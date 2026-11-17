"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { prepararSom } from "@/camera/som";
import { botaoPrimario, botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { Gabarito, dicaDoGabarito } from "@/componentes/Gabarito";
import type { BlocoEnviado } from "@/dominio/agregar";
import {
  descreverMetodo, metodoLegado, montarLinhaDoTempo, NOME_METODO, formatarTempo,
  type FaseTrabalho, type Metodo, type ResumoMetodo,
} from "@/dominio/metodos";
import { ROTULO_EQUIPAMENTO, ROTULO_MODALIDADE } from "@/dominio/trilha";
import { exercicioPorId, paraMetodo } from "@/exercicios";
import { finalizarDesafio, type ResultadoDesafio } from "./acoes";
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
  /** Método do desafio; null quando o banco ainda não tem a migração 0008. */
  metodo: Metodo | null;
}

type Etapa = "pronto" | "camera" | "manual";

/** O que cada exercício faz no desafio, ex.: "3 × 10 reps" ou "4 × 30 s". */
function resumoDoExercicio(fases: FaseTrabalho[], exercicio: number): string {
  const minhas = fases.filter((f) => f.exercicio === exercicio);
  if (minhas.length === 0) return "";
  const f = minhas[0];
  const vezes = minhas.length > 1 ? `${minhas.length} × ` : "";
  if (f.emom) return `${vezes}${f.alvoReps} reps no minuto`;
  if (f.alvoReps !== undefined) {
    const iguais = minhas.every((m) => m.alvoReps === f.alvoReps);
    return iguais ? `${vezes}${f.alvoReps} reps` : minhas.map((m) => m.alvoReps).join("-") + " reps";
  }
  const s = Math.round((f.duracaoMs ?? 0) / 1000);
  const meta = f.sustentar ? "segurando" : f.faixa ? `${f.faixa.min} a ${f.faixa.max} reps` : "máximo de reps";
  return `${vezes}${s} s · ${meta}`;
}

export function Desafio(props: Props) {
  const { id, titulo, modalidade, contexto, xp, equipamento, jaFeito, blocos } = props;
  const linha = useMemo(() => {
    const ex = blocos.map((b) => {
      const def = exercicioPorId(b.exercicioId);
      return def ? paraMetodo(def) : { nome: b.exercicio, sustentacao: false, segPorRep: 3 };
    });
    return montarLinhaDoTempo(props.metodo ?? metodoLegado(blocos.map((b) => b.segundos), ex), ex);
  }, [blocos, props.metodo]);
  const trabalhos = linha.fases.filter((f): f is FaseTrabalho => f.tipo === "trabalho");
  const [etapa, setEtapa] = useState<Etapa>("pronto");
  const [avisoCamera, setAvisoCamera] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDesafio | null>(null);
  const [envio, setEnvio] = useState<{ modo: "camera" | "manual"; numeros: BlocoEnviado[]; resumo: ResumoMetodo } | null>(null);
  const [enviando, iniciar] = useTransition();

  const finalizar = (modo: "camera" | "manual", numeros: BlocoEnviado[], resumo: ResumoMetodo) => {
    setEnvio({ modo, numeros, resumo });
    iniciar(async () => setResultado(await finalizarDesafio(id, modo, numeros)));
  };

  if (resultado?.ok && envio) return <Resultado resultado={resultado} resumo={envio.resumo} />;

  // O desafio terminou mas o envio falhou: deixa tentar de novo sem refazer.
  if (envio && (enviando || resultado?.erro)) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-5 px-5">
        <h1 className="text-2xl font-black">{enviando ? "Registrando seu desafio…" : "Não consegui registrar"}</h1>
        {resultado?.erro && <p role="alert" className="text-base leading-relaxed text-apagado">{resultado.erro}</p>}
        {!enviando && (
          <>
            <button onClick={() => finalizar(envio.modo, envio.numeros, envio.resumo)} className={botaoPrimario}>Tentar de novo</button>
            <Link href="/trilha" className={botaoSecundario}>Voltar para a trilha</Link>
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
        linha={linha}
        comCamera={etapa === "camera"}
        aoFim={(numeros, resumo) => finalizar(etapa === "camera" ? "camera" : "manual", numeros, resumo)}
        aoSemCamera={(mensagem) => {
          setAvisoCamera(mensagem);
          setEtapa("pronto");
        }}
      />
    );
  }

  const detalhe = [
    ROTULO_MODALIDADE[modalidade] !== titulo ? ROTULO_MODALIDADE[modalidade] : null,
    `cerca de ${formatarTempo(linha.duracaoEstimadaS)}`,
    `+${xp} XP`,
    equipamento ? ROTULO_EQUIPAMENTO[equipamento] : null,
  ].filter(Boolean).join(" · ");

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-start gap-2">
        <Link href="/trilha" aria-label="Voltar para a trilha" className="-ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-apagado active:bg-superficie">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </Link>
        <div className="min-w-0 pt-1">
          <p className="truncate text-[12px] font-black uppercase tracking-[0.12em] text-apagado">{contexto}</p>
          <h1 className="text-2xl font-black leading-tight">{titulo}</h1>
          <p className="text-sm text-apagado">{detalhe}</p>
        </div>
      </header>

      <section className={`${cartao} mt-5 border-mel/50`}>
        <p className={sobrelinha}>{NOME_METODO[linha.metodo.tipo]}</p>
        <p className="mt-1 text-lg font-bold leading-snug">{descreverMetodo(linha.metodo)}</p>
        <PrevisaoFases linha={linha} />
      </section>

      <section className="mt-5 flex-1">
        <h2 className="text-base font-bold">Exercícios</h2>
        <ol className="mt-3 flex flex-col gap-2.5">
          {blocos.map((b, i) => (
            <li key={b.ordem} className={`${cartao} flex items-center gap-3 py-2.5`}>
              <Gabarito exercicio={b.exercicioId} tamanho={76} className="shrink-0 rounded-xl bg-fundo" />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">{b.exercicio}</p>
                <p className="text-sm font-semibold text-mel">{resumoDoExercicio(trabalhos, i)}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-apagado">
                  {b.lateral ? "De lado para o celular. " : "De frente para o celular. "}
                  {dicaDoGabarito(b.exercicioId)}
                </p>
              </div>
            </li>
          ))}
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

/** Faixa colorida com as fases do desafio: trabalho em amarelo, descanso em cinza. */
function PrevisaoFases({ linha }: { linha: ReturnType<typeof montarLinhaDoTempo> }) {
  const fases = linha.fases.filter((f) => f.tipo !== "preparo");
  const peso = (f: (typeof fases)[number]) =>
    f.tipo === "trabalho" ? (f.duracaoMs ?? 20_000) : f.duracaoMs;
  const total = fases.reduce((s, f) => s + peso(f), 0) || 1;
  return (
    <div className="mt-3" aria-hidden>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-superficie-2">
        {fases.map((f, i) => (
          <span
            key={i}
            className={f.tipo === "trabalho" ? "bg-mel" : f.tipo === "descanso" ? "bg-[#5A5E68]" : "bg-[#F5F2EA]/70"}
            style={{ width: `${(100 * peso(f)) / total}%`, borderRight: "2px solid #17191e" }}
          />
        ))}
      </div>
      <p className="mt-1.5 flex gap-4 text-xs font-semibold text-apagado">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-mel align-middle" />trabalho</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#5A5E68] align-middle" />descanso</span>
      </p>
    </div>
  );
}

function Resultado({ resultado, resumo }: { resultado: ResultadoDesafio; resumo: ResumoMetodo }) {
  const titulo = resultado.nivel_concluido ? "Seção concluída" : resultado.unidade_concluida ? "Unidade concluída" : "Desafio concluído";
  const notas: string[] = [];
  if (resultado.sem_movimento) notas.push("A câmera não viu movimento em pelo menos metade dos exercícios, então valeu como modo sem câmera (metade do XP).");
  else if (resultado.modo === "manual") notas.push("Sem câmera vale metade do XP.");
  if (resultado.refazer_sem_xp) notas.push("Você já refez este desafio hoje, então ele não soma XP de novo. O treino valeu do mesmo jeito.");
  else if (resultado.refeito) notas.push("Refazer vale 1/3 do XP, uma vez por dia.");
  if (resultado.primeiro_do_dia) notas.push("Inclui o bônus do primeiro desafio do dia.");
  if (resultado.unidade_sessao) notas.push("+50 XP por fechar a unidade numa única sessão.");
  if (resultado.nivel_concluido) notas.push(resultado.proximo_nivel ? `+30 XP pela seção. A Seção ${resultado.proximo_nivel} está liberada.` : "+30 XP: você fechou a última seção da trilha.");

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(2rem,env(safe-area-inset-top))]">
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className={sobrelinha}>{titulo}</p>
        <p className="text-[5.5rem] font-black leading-none text-mel tabular-nums">+{resultado.xp}</p>
        <p className="-mt-2 text-2xl font-black">XP</p>
        <div className={`${cartao} w-full`}>
          <p className="text-xl font-black leading-tight">{resumo.titulo}</p>
          {resumo.detalhes.map((d) => (
            <p key={d} className="mt-1 text-[15px] text-apagado">{d}</p>
          ))}
        </div>
        {notas.length > 0 && (
          <ul className="flex max-w-[20rem] flex-col gap-1 text-[15px] leading-relaxed text-apagado">
            {notas.map((nota) => <li key={nota}>{nota}</li>)}
          </ul>
        )}
        <div className={`${cartao} w-full`}>
          <p className="text-lg font-black">
            Ofensiva: {resultado.ofensiva} {resultado.ofensiva === 1 ? "dia" : "dias"}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-apagado">
            {resultado.unidade_concluida ? "A próxima unidade já está liberada na trilha." : "O próximo desafio já está liberado na trilha."}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/trilha" className={botaoPrimario}>
          Continuar
        </Link>
        <Link href="/amigos" className={botaoSecundario}>
          Convidar amigos
        </Link>
      </div>
    </main>
  );
}

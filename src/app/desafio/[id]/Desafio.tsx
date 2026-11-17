"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { prepararSom, som } from "@/camera/som";
import { botaoPrimario, botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { formatarDuracao, ROTULO_EQUIPAMENTO, ROTULO_MODALIDADE } from "@/dominio/trilha";
import { finalizarDesafio, type BlocoEnviado, type ResultadoDesafio } from "./acoes";
import { ExecucaoCamera } from "./ExecucaoCamera";
import { TimerManual } from "./TimerManual";

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
}

type Etapa = "pronto" | "camera" | "manual";

export function Desafio(props: Props) {
  const { id, titulo, modalidade, contexto, xp, equipamento, jaFeito, blocos } = props;
  const total = blocos.reduce((s, b) => s + b.segundos, 0);
  const [etapa, setEtapa] = useState<Etapa>("pronto");
  const [avisoCamera, setAvisoCamera] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDesafio | null>(null);
  const [enviados, setEnviados] = useState<BlocoEnviado[]>([]);
  const [enviando, iniciar] = useTransition();

  const finalizar = (modo: "camera" | "manual", numeros: BlocoEnviado[]) => {
    setEnviados(numeros);
    iniciar(async () => setResultado(await finalizarDesafio(id, modo, numeros)));
  };

  if (resultado?.ok) return <Resultado resultado={resultado} blocos={blocos} enviados={enviados} />;

  // A câmera terminou mas o envio falhou: deixa tentar de novo sem refazer o desafio.
  if (etapa === "camera" && (enviando || resultado?.erro)) {
    return (
      <main className="flex min-h-dvh flex-col justify-center gap-5 px-5">
        <h1 className="text-2xl font-black">{enviando ? "Registrando seu desafio…" : "Não consegui registrar"}</h1>
        {resultado?.erro && <p role="alert" className="text-base leading-relaxed text-apagado">{resultado.erro}</p>}
        {!enviando && (
          <>
            <button onClick={() => finalizar("camera", enviados)} className={botaoPrimario}>Tentar de novo</button>
            <Link href="/trilha" className={botaoSecundario}>Voltar para a trilha</Link>
          </>
        )}
      </main>
    );
  }

  if (etapa === "camera") {
    return (
      <ExecucaoCamera
        id={id}
        titulo={titulo}
        blocos={blocos}
        aoFim={(numeros) => finalizar("camera", numeros)}
        aoSemCamera={(mensagem) => {
          setAvisoCamera(mensagem);
          setEtapa("manual");
        }}
      />
    );
  }

  const detalhe = [ROTULO_MODALIDADE[modalidade] !== titulo ? ROTULO_MODALIDADE[modalidade] : null, formatarDuracao(total), `+${xp} XP`, equipamento ? ROTULO_EQUIPAMENTO[equipamento] : null]
    .filter(Boolean)
    .join(" · ");

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

      {etapa === "manual" ? (
        <TimerManual
          blocos={blocos}
          aviso={avisoCamera}
          enviando={enviando}
          erro={resultado?.erro ?? null}
          aoConcluir={() => finalizar("manual", [])}
        />
      ) : (
        <>
          <section className="mt-6 flex-1">
            <h2 className="text-base font-bold">Neste desafio</h2>
            <ol className="mt-3 flex flex-col gap-2.5">
              {blocos.map((b, i) => (
                <li key={b.ordem} className={`${cartao} flex items-center gap-3 py-3`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mel/15 text-lg font-black text-mel">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-tight">{b.exercicio}</p>
                    <p className="text-sm text-apagado">
                      {formatarDuracao(b.segundos)} · {b.lateral ? "de lado para o celular" : "de frente para o celular"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[15px] leading-relaxed text-apagado">
              A câmera conta as repetições e confere a execução. O vídeo é analisado no seu aparelho: nenhuma imagem é gravada ou enviada.
              {jaFeito ? " Você já fez este desafio: refazer vale 1/3 do XP, uma vez por dia." : ""}
            </p>
          </section>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                prepararSom();
                setEtapa("camera");
              }}
              className={botaoPrimario}
            >
              Começar com a câmera
            </button>
            <button
              onClick={() => {
                prepararSom();
                som.tique();
                setEtapa("manual");
              }}
              className={botaoSecundario}
            >
              Fazer sem câmera (metade do XP)
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Resultado({ resultado, blocos, enviados }: { resultado: ResultadoDesafio; blocos: BlocoDesafio[]; enviados: BlocoEnviado[] }) {
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
        {notas.length > 0 && (
          <ul className="flex max-w-[20rem] flex-col gap-1 text-[15px] leading-relaxed text-apagado">
            {notas.map((nota) => <li key={nota}>{nota}</li>)}
          </ul>
        )}
        {enviados.length > 0 && (
          <dl className={`${cartao} w-full text-left text-[15px]`}>
            {blocos.map((b) => {
              const n = enviados.find((e) => e.ordem === b.ordem);
              const valor = !n ? "—" : n.reps_validas > 0 ? `${n.reps_validas} ${n.reps_validas === 1 ? "repetição" : "repetições"}` : n.tempo_valido_s > 0 ? `${Math.round(n.tempo_valido_s)} s na posição` : "sem contagem";
              return (
                <div key={b.ordem} className="flex items-baseline justify-between gap-3 py-1.5">
                  <dt className="min-w-0 truncate text-apagado">{b.exercicio}</dt>
                  <dd className="shrink-0 font-bold tabular-nums">{valor}</dd>
                </div>
              );
            })}
          </dl>
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

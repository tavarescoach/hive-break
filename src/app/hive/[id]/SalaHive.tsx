"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Desafio } from "@/app/desafio/[id]/Desafio";
import { botaoPrimario, botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { relogio, segundosAte, textoConviteHive, type DadosHive } from "@/dominio/hive";
import { comecarHiveAgora, definirCompeticao, entrarHive, lerHive } from "../acoes";
import { Hexagono, ProvedorHive, useHive } from "../AoVivo";
import { CardColetivo } from "../CardColetivo";

type PropsDesafio = React.ComponentProps<typeof Desafio>;

interface Props {
  inicial: DadosHive;
  desafio: PropsDesafio;
  /** O desafio está acima da liberação da triagem desta pessoa. */
  travado: boolean;
  eu: { id: string; apelido: string; avatarUrl: string | null };
}

/** Relógio que anda a cada 500 ms (para a contagem da sala). */
function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return agora;
}

export function SalaHive({ inicial, desafio, travado, eu }: Props) {
  const router = useRouter();
  const [hive, setHive] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, iniciar] = useTransition();

  // Lista de quem está na hive (do banco) atualizada a cada 4 s.
  useEffect(() => {
    const t = setInterval(async () => {
      const dados = await lerHive(hive.id);
      if (dados) setHive(dados);
    }, 4000);
    return () => clearInterval(t);
  }, [hive.id]);

  // Só decide na abertura: quem termina o desafio aqui continua na tela de resultado.
  const [jaFez] = useState(() => inicial.participantes.some((p) => p.id === eu.id && p.concluido));

  if (!hive.sou_participante) {
    const entrar = () =>
      iniciar(async () => {
        setErro(null);
        const r = await entrarHive(hive.id);
        if (!r.ok) return setErro(r.erro ?? "Não consegui entrar.");
        const dados = await lerHive(hive.id);
        if (dados) setHive(dados);
        router.refresh();
      });
    return (
      <main className="flex min-h-dvh flex-col gap-5 px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Link href="/hive" className="text-sm font-bold text-apagado">‹ Hives</Link>
        <header>
          <p className={sobrelinha}>Hive de {hive.anfitriao ?? "alguém"}</p>
          <h1 className="mt-1 text-3xl font-black leading-tight">{hive.desafio}</h1>
          <p className="mt-1 text-base text-apagado">
            {relogio(hive.duracao_s)} · {hive.participantes.length} {hive.participantes.length === 1 ? "pessoa" : "pessoas"}
            {hive.modo_competicao ? " · modo competição" : ""}
          </p>
        </header>
        <Participantes hive={hive} euId={eu.id} />
        {hive.status === "encerrada" ? (
          <>
            <p className={`${cartao} text-[15px]`}>Essa hive já acabou.</p>
            <Link href="/hive" className={botaoPrimario}>Ver hives ao vivo</Link>
          </>
        ) : travado ? (
          <p className={`${cartao} border-atencao/60 text-[15px] leading-relaxed`}>
            Esse desafio tem intensidade acima da sua liberação da triagem. Escolha outra hive.
          </p>
        ) : (
          <>
            {hive.status === "andamento" && (
              <p className="text-[15px] leading-relaxed text-apagado">
                Já começou. Você faz do início, no seu ritmo, e entra no mesmo card de resultado.
              </p>
            )}
            {erro && <p role="alert" className="text-[15px] text-ruim">{erro}</p>}
            <button onClick={entrar} disabled={entrando} className={`${botaoPrimario} mt-auto`}>
              {entrando ? "Entrando…" : "Join"}
            </button>
          </>
        )}
      </main>
    );
  }

  return (
    <ProvedorHive hiveId={hive.id} euId={eu.id} apelido={eu.apelido} avatarUrl={eu.avatarUrl} competicao={hive.modo_competicao}>
      {jaFez ? (
        <main className="flex min-h-dvh flex-col gap-4 px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
          <p className={sobrelinha}>Você já fez esta hive</p>
          <CardColetivo hiveId={hive.id} euId={eu.id} inicial={hive} />
          <Link href="/hive" className={`${botaoPrimario} mt-auto`}>Ver outras hives</Link>
          <Link href="/trilha" className={botaoSecundario}>Voltar para a trilha</Link>
        </main>
      ) : (
        <Sala hive={hive} desafio={desafio} euId={eu.id} aoMudar={setHive} />
      )}
    </ProvedorHive>
  );
}

/** Sala de espera de 60 s; quando zera, abre o desafio para todo mundo. */
function Sala({ hive, desafio, euId, aoMudar }: { hive: DadosHive; desafio: PropsDesafio; euId: string; aoMudar: (h: DadosHive) => void }) {
  const agora = useAgora();
  const aoVivo = useHive();
  const [, iniciar] = useTransition();
  const [comecou, setComecou] = useState(false);
  const restante = segundosAte(hive.inicio_em, agora);
  const anfitriao = hive.anfitriao_id === euId;

  if (comecou || restante === 0) {
    return <Desafio {...desafio} />;
  }

  const comecarJa = () =>
    iniciar(async () => {
      await comecarHiveAgora(hive.id);
      const dados = await lerHive(hive.id);
      if (dados) aoMudar(dados);
      setComecou(true);
    });
  const alternarCompeticao = () =>
    iniciar(async () => {
      await definirCompeticao(hive.id, !hive.modo_competicao);
      const dados = await lerHive(hive.id);
      if (dados) aoMudar(dados);
    });
  const chamar = async () => {
    const texto = textoConviteHive(hive, `${window.location.origin}/hive/${hive.id}`);
    if (navigator.share) await navigator.share({ text: texto }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  return (
    <main className="flex min-h-dvh flex-col gap-5 px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="text-center">
        <p className={sobrelinha}>Hive de {anfitriao ? "você" : hive.anfitriao ?? "alguém"}</p>
        <h1 className="mt-1 text-2xl font-black leading-tight">{desafio.titulo}</h1>
        <p role="timer" aria-live="off" className="mt-3 text-[4.5rem] font-black leading-none text-mel tabular-nums">{relogio(restante)}</p>
        <p className="mt-1 text-sm text-apagado">começa sozinho quando zerar</p>
      </header>

      <Participantes hive={hive} euId={euId} aoVivo={aoVivo?.colegas.map((c) => c.id)} />

      <p className={`${cartao} text-[14px] leading-relaxed text-apagado`}>
        Ninguém vê sua câmera, só seus números.
        {hive.modo_competicao ? " Modo competição: os reps de todos aparecem ao vivo." : " Os reps dos colegas aparecem só no card do fim."}
      </p>

      {anfitriao && (
        <label className={`${cartao} flex min-h-14 cursor-pointer items-center justify-between gap-3 py-3`}>
          <span>
            <span className="block font-bold">Modo competição</span>
            <span className="block text-sm text-apagado">Mostra os reps de todos durante o exercício</span>
          </span>
          <input type="checkbox" checked={hive.modo_competicao} onChange={alternarCompeticao} className="h-6 w-6 accent-[#ffc42e]" />
        </label>
      )}

      <div className="mt-auto flex flex-col gap-3">
        <button onClick={chamar} className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#25D366] text-lg font-black text-[#0B3A1E] active:opacity-90">
          Chamar no WhatsApp
        </button>
        {anfitriao && (
          <button onClick={comecarJa} className={botaoPrimario}>Começar já</button>
        )}
      </div>
    </main>
  );
}

function Participantes({ hive, euId, aoVivo }: { hive: DadosHive; euId: string; aoVivo?: string[] }) {
  return (
    <ul aria-label="Quem está na hive" className="grid grid-cols-4 gap-3">
      {hive.participantes.map((p) => {
        const conectado = p.id === euId || !aoVivo || aoVivo.includes(p.id);
        return (
          <li key={p.id} className="flex flex-col items-center gap-1 text-center">
            <Hexagono nome={p.apelido} url={p.avatar_url} tamanho={48} destaque={p.id === euId || p.id === hive.anfitriao_id} apagado={!conectado} />
            <span className="w-full truncate text-[13px] font-semibold">{p.id === euId ? "você" : p.apelido}</span>
            <span className="text-[11px] text-apagado">
              {p.id === hive.anfitriao_id ? "anfitrião" : p.concluido ? "terminou" : conectado ? "pronto" : "entrando…"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

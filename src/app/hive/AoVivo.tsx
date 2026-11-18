"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { bonusPorTamanho, ROTULO_ETAPA, type PresencaHive } from "@/dominio/hive";
import { criarClienteNavegador } from "@/lib/supabase/navegador";
import { registrarHighFive } from "./acoes";

/**
 * Tempo real da hive: cada pessoa publica no canal `hive:<id>` só a etapa em
 * que está (sala, preparo, série, pausa, terminou), a série e as reps. Nenhuma
 * imagem sai do aparelho. Quando o Realtime não conecta, a hive continua
 * funcionando sem a faixa ao vivo.
 */

export interface ContextoHive {
  hiveId: string;
  eu: PresencaHive;
  competicao: boolean;
  /** Colegas conectados agora (sem incluir você). */
  colegas: PresencaHive[];
  /** Avisos curtos: "Ana fechou a série 2", "Bruno mandou um high five". */
  avisos: { id: number; texto: string }[];
  publicar: (mudanca: Partial<Omit<PresencaHive, "id" | "apelido" | "avatar_url">>) => void;
  highFive: (para: string) => void;
}

const Contexto = createContext<ContextoHive | null>(null);

/** null fora de uma hive: a tela do desafio funciona igual a antes. */
export function useHive(): ContextoHive | null {
  return useContext(Contexto);
}

const INTERVALO_MS = 1000;
const AVISO_MS = 2500;

export function ProvedorHive({
  hiveId, euId, apelido, avatarUrl, competicao, children,
}: {
  hiveId: string;
  euId: string;
  apelido: string;
  avatarUrl: string | null;
  competicao: boolean;
  children: React.ReactNode;
}) {
  const [colegas, setColegas] = useState<PresencaHive[]>([]);
  const [avisos, setAvisos] = useState<{ id: number; texto: string }[]>([]);
  const [eu, setEu] = useState<PresencaHive>({ id: euId, apelido, avatar_url: avatarUrl, etapa: "sala", serie: 0, total: 0, reps: 0 });
  const euRef = useRef(eu);
  const canalRef = useRef<RealtimeChannel | null>(null);
  const conectadoRef = useRef(false);
  const ultimoEnvioRef = useRef(0);
  const pendenteRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anterioresRef = useRef(new Map<string, PresencaHive>());
  const contadorRef = useRef(0);

  const avisar = useCallback((texto: string) => {
    const id = ++contadorRef.current;
    setAvisos((lista) => [...lista.slice(-2), { id, texto }]);
    setTimeout(() => setAvisos((lista) => lista.filter((a) => a.id !== id)), AVISO_MS);
  }, []);

  const enviar = useCallback(() => {
    pendenteRef.current = null;
    ultimoEnvioRef.current = Date.now();
    if (conectadoRef.current) void canalRef.current?.track(euRef.current).catch(() => {});
  }, []);

  const publicar = useCallback<ContextoHive["publicar"]>(
    (mudanca) => {
      const atual = euRef.current;
      const novo = { ...atual, ...mudanca };
      if (novo.etapa === atual.etapa && novo.serie === atual.serie && novo.total === atual.total && novo.reps === atual.reps) return;
      euRef.current = novo;
      setEu(novo);
      // No máximo um envio por segundo; mudança de etapa vai na hora.
      const espera = mudanca.etapa && mudanca.etapa !== atual.etapa ? 0 : INTERVALO_MS - (Date.now() - ultimoEnvioRef.current);
      if (espera <= 0) {
        if (pendenteRef.current) clearTimeout(pendenteRef.current);
        enviar();
      } else if (!pendenteRef.current) {
        pendenteRef.current = setTimeout(enviar, espera);
      }
    },
    [enviar],
  );

  useEffect(() => {
    const supabase = criarClienteNavegador();
    const canal = supabase.channel(`hive:${hiveId}`, { config: { presence: { key: euId }, broadcast: { self: false } } });
    canalRef.current = canal;
    const anteriores = anterioresRef.current;

    canal.on("presence", { event: "sync" }, () => {
      const estado = canal.presenceState<PresencaHive>();
      const agora: PresencaHive[] = [];
      for (const [chave, metas] of Object.entries(estado)) {
        const ultima = metas[metas.length - 1];
        if (!ultima || chave === euId) continue;
        const p: PresencaHive = {
          id: chave, apelido: ultima.apelido, avatar_url: ultima.avatar_url,
          etapa: ultima.etapa, serie: ultima.serie, total: ultima.total, reps: ultima.reps,
        };
        const antes = anteriores.get(chave);
        if (!antes) avisar(`${p.apelido} entrou na hive`);
        else if (p.etapa === "terminou" && antes.etapa !== "terminou") avisar(`${p.apelido} terminou`);
        else if (p.etapa === "pausa" && antes.etapa === "serie") avisar(`${p.apelido} fechou a série ${antes.serie}`);
        anteriores.set(chave, p);
        agora.push(p);
      }
      setColegas(agora);
    });
    canal.on("broadcast", { event: "high_five" }, ({ payload }) => {
      const { de, para } = payload as { de?: string; para?: string };
      if (para === euId && de) avisar(`${de} mandou um high five`);
    });
    canal.subscribe((status) => {
      conectadoRef.current = status === "SUBSCRIBED";
      if (status === "SUBSCRIBED") enviar();
    });

    return () => {
      conectadoRef.current = false;
      if (pendenteRef.current) clearTimeout(pendenteRef.current);
      void supabase.removeChannel(canal);
      canalRef.current = null;
    };
  }, [hiveId, euId, avisar, enviar]);

  const highFive = useCallback(
    (para: string) => {
      void canalRef.current?.send({ type: "broadcast", event: "high_five", payload: { de: euRef.current.apelido, para } });
      void registrarHighFive(hiveId, para).catch(() => {});
      const nome = colegas.find((c) => c.id === para)?.apelido;
      if (nome) avisar(`High five para ${nome}`);
    },
    [avisar, colegas, hiveId],
  );

  const valor = useMemo<ContextoHive>(
    () => ({ hiveId, eu, competicao, colegas, avisos, publicar, highFive }),
    [hiveId, eu, competicao, colegas, avisos, publicar, highFive],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Hexágono com a inicial (ou a foto) da pessoa. */
export function Hexagono({
  nome, url, tamanho = 30, destaque = false, apagado = false,
}: {
  nome: string;
  url?: string | null;
  tamanho?: number;
  destaque?: boolean;
  apagado?: boolean;
}) {
  const recorte = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho * 1.12, clipPath: recorte, fontSize: tamanho * 0.4 }}
      className={`flex shrink-0 items-center justify-center overflow-hidden font-black ${
        destaque ? "bg-mel text-black" : apagado ? "bg-superficie-2 text-apagado" : "bg-[#3a3d45] text-texto"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto pequena vinda do Google
        <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        nome.trim().charAt(0).toUpperCase() || "?"
      )}
    </span>
  );
}

/**
 * Faixa fina no topo da tela do exercício com quem está hiving junto. Nunca
 * cobre a câmera. Mostra a etapa de cada um; os reps só no modo competição.
 * Na pausa, tocar num colega manda um high five.
 */
export function FaixaHive({ descansando }: { descansando: boolean }) {
  const hive = useHive();
  if (!hive) return null;
  const { eu, colegas, competicao, highFive } = hive;
  const tamanho = descansando ? 34 : 26;
  const visiveis = colegas.slice(0, 6);
  return (
    <section aria-label={`Hiving com você: ${colegas.length}`} className="flex items-center gap-2 overflow-hidden bg-[#111216] px-3 py-1.5">
      <div className="flex shrink-0 flex-col items-center">
        <Hexagono nome={eu.apelido} url={eu.avatar_url} tamanho={tamanho} destaque />
        <span className="text-[11px] font-bold text-mel">você</span>
      </div>
      {visiveis.map((c) => {
        const conteudo = (
          <>
            <Hexagono nome={c.apelido} url={c.avatar_url} tamanho={tamanho} apagado={c.etapa === "pausa" || c.etapa === "terminou"} />
            <span className="max-w-[3.5rem] truncate text-[11px] font-semibold text-white/70">
              {competicao && c.etapa !== "sala" ? `${c.reps}` : ROTULO_ETAPA[c.etapa]}
            </span>
          </>
        );
        return descansando ? (
          <button
            key={c.id}
            onClick={() => highFive(c.id)}
            aria-label={`Mandar high five para ${c.apelido}`}
            className="flex shrink-0 flex-col items-center rounded-lg active:bg-white/10"
          >
            {conteudo}
          </button>
        ) : (
          <div key={c.id} className="flex shrink-0 flex-col items-center" title={c.apelido}>
            {conteudo}
          </div>
        );
      })}
      <p className="ml-auto shrink-0 pl-1 text-right text-[12px] font-semibold leading-tight text-white/60">
        {bonusPorTamanho(colegas.length + 1) > 0 && <span className="text-mel">+{bonusPorTamanho(colegas.length + 1)}% · </span>}
        {colegas.length + 1} hiving
        {descansando && colegas.length > 0 && <span className="block text-mel">toque p/ high five</span>}
      </p>
    </section>
  );
}

/** Avisos de 2,5 s no canto da câmera. */
export function AvisosHive() {
  const hive = useHive();
  if (!hive || hive.avisos.length === 0) return null;
  return (
    <div aria-live="polite" className="pointer-events-none absolute right-2 top-2 z-[1] flex flex-col items-end gap-1">
      {hive.avisos.map((a) => (
        <p key={a.id} className="rounded-lg bg-black/75 px-2.5 py-1 text-[13px] font-semibold text-white">
          {a.texto}
        </p>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { desativarTodosLembretes, salvarPreferencia } from "@/app/lembretes/acoes";
import { botaoSecundario, cartao } from "@/componentes/estilos";
import { CATEGORIAS_LEMBRETE, type CategoriaLembrete } from "@/dominio/lembretes";
import { aparelhoInscrito, ativarPushNesteAparelho, pushSuportado } from "@/lib/push-navegador";

export interface PreferenciasLembrete extends Record<CategoriaLembrete, boolean> {
  push_ativo: boolean;
  email_ativo: boolean;
}

/**
 * Lembretes já vêm ligados. Aqui a pessoa desativa por categoria ou tudo de
 * uma vez; cada interruptor salva na hora.
 */
export function Lembretes({ inicial }: { inicial: PreferenciasLembrete }) {
  const [prefs, setPrefs] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [aparelho, setAparelho] = useState<"carregando" | "inscrito" | "livre" | "sem_suporte">("carregando");

  useEffect(() => {
    void (async () => {
      if (!pushSuportado()) return setAparelho("sem_suporte");
      setAparelho((await aparelhoInscrito()) ? "inscrito" : "livre");
    })();
  }, []);

  const mudar = (campo: CategoriaLembrete | "push_ativo", valor: boolean) => {
    const anterior = prefs;
    setPrefs({ ...prefs, [campo]: valor, ...(valor && campo !== "push_ativo" ? { email_ativo: true } : {}) });
    setErro("");
    iniciar(async () => {
      const { ok } = await salvarPreferencia(campo, valor);
      if (!ok) {
        setPrefs(anterior);
        setErro("Não consegui salvar. Confira a internet e tente de novo.");
      }
    });
  };

  const desligarTudo = () => {
    const anterior = prefs;
    setPrefs({ lembrete: false, ofensiva: false, amigos: false, liga: false, resumo_semanal: false, push_ativo: false, email_ativo: false });
    iniciar(async () => {
      const { ok } = await desativarTodosLembretes();
      if (!ok) {
        setPrefs(anterior);
        setErro("Não consegui salvar. Confira a internet e tente de novo.");
      }
    });
  };

  const ligarAparelho = async () => {
    const r = await ativarPushNesteAparelho();
    if (r === "ok") {
      setAparelho("inscrito");
      setPrefs((p) => ({ ...p, push_ativo: true }));
    } else {
      setErro(r === "negado" ? "As notificações estão bloqueadas nas configurações do navegador." : "Não consegui ligar as notificações neste aparelho.");
    }
  };

  const tudoDesligado = CATEGORIAS_LEMBRETE.every((c) => !prefs[c.campo]) && !prefs.push_ativo;
  const pushLigado = prefs.push_ativo && aparelho === "inscrito";

  return (
    <section className="flex flex-col gap-3" aria-labelledby="titulo-lembretes">
      <h2 id="titulo-lembretes" className="text-xl font-black">
        Lembretes
      </h2>
      <div className={`${cartao} flex flex-col divide-y divide-borda p-0`}>
        {CATEGORIAS_LEMBRETE.map((c) => (
          <Interruptor
            key={c.campo}
            rotulo={c.rotulo}
            descricao={c.descricao}
            ligado={prefs[c.campo]}
            onChange={(v) => mudar(c.campo, v)}
          />
        ))}
      </div>

      <div className={cartao}>
        {aparelho === "sem_suporte" ? (
          <p className="text-[15px] leading-relaxed text-apagado">
            Notificações no celular: no iPhone, funcionam com o Hive Break instalado na tela inicial. Os lembretes chegam por e-mail.
          </p>
        ) : pushLigado ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">Notificações no celular: ligadas</p>
              <p className="text-sm text-apagado">Sem elas, os lembretes chegam por e-mail.</p>
            </div>
            <button onClick={() => mudar("push_ativo", false)} disabled={pendente} className="h-12 shrink-0 rounded-xl border border-borda px-4 font-bold">
              Desativar
            </button>
          </div>
        ) : aparelho === "livre" || (aparelho === "inscrito" && !prefs.push_ativo) ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] leading-relaxed text-apagado">Notificações no celular: desligadas. Os lembretes chegam por e-mail.</p>
            <button
              onClick={() => (aparelho === "inscrito" ? mudar("push_ativo", true) : void ligarAparelho())}
              disabled={pendente}
              className="h-12 shrink-0 rounded-xl border border-borda px-4 font-bold"
            >
              Ligar
            </button>
          </div>
        ) : null}
      </div>

      {erro && (
        <p role="alert" className="text-sm text-apagado">
          {erro}
        </p>
      )}
      <button onClick={desligarTudo} disabled={pendente || tudoDesligado} className={botaoSecundario}>
        {tudoDesligado ? "Todos os lembretes estão desativados" : "Desativar todos os lembretes"}
      </button>
    </section>
  );
}

function Interruptor({
  rotulo, descricao, ligado, onChange,
}: {
  rotulo: string;
  descricao: string;
  ligado: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="block font-bold">{rotulo}</span>
        <span className="block text-sm leading-snug text-apagado">{descricao}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={ligado}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-8 w-14 shrink-0 rounded-full bg-borda transition-colors peer-checked:bg-mel peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-mel after:absolute after:left-1 after:top-1 after:h-6 after:w-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-6"
      />
    </label>
  );
}

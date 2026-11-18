import type { Metadata } from "next";
import { Fragment } from "react";
import { Avatar } from "@/componentes/Avatar";
import { cartao, sobrelinha } from "@/componentes/estilos";
import { NOMES_DIVISAO, textoRegra, textoSemanaPassada, textoSemTreino, textoZona, type DadosLiga } from "@/dominio/liga";
import { exigirCadastroCompleto } from "@/lib/sessao";

export const metadata: Metadata = { title: "Liga · Hive Break" };

const COR_ZONA = { subida: "border-bom/50 bg-bom/10", meio: "border-borda bg-superficie", descida: "border-atencao/50 bg-atencao/10" };

export default async function Liga() {
  const sessao = await exigirCadastroCompleto();
  const { data, error } = await sessao.supabase.rpc("ler_liga");
  const dados = (error ? null : data) as DadosLiga | null;
  const divisao = NOMES_DIVISAO[dados?.divisao ?? (sessao.perfil.divisao_atual as keyof typeof NOMES_DIVISAO)];

  return (
    <main className="flex flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Liga</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Divisão {divisao}</h1>
        <p className="mt-1 text-[15px] text-apagado">A semana fecha domingo às 23h59.</p>
      </header>

      {dados?.semana_passada && (
        <section className={`${cartao} border-mel/40`}>
          <p className="text-base font-bold leading-snug">{textoSemanaPassada(dados.semana_passada)}</p>
        </section>
      )}

      {!dados ? (
        <section className={cartao}>
          <p className="text-lg font-bold leading-tight">Não consegui carregar a liga</p>
          <p className="mt-1 text-[15px] leading-relaxed text-apagado">Confira a internet e abra de novo.</p>
        </section>
      ) : !dados.no_grupo ? (
        <section className={cartao}>
          <p className="text-lg font-bold leading-tight">Seu grupo da semana já já aparece</p>
          <p className="mt-1 text-[15px] leading-relaxed text-apagado">
            Termine o cadastro e você entra num grupo de até 15 pessoas da sua divisão.
          </p>
        </section>
      ) : (
        <>
          <section className={`rounded-2xl border p-4 ${COR_ZONA[dados.zona]}`}>
            <p className="text-sm font-semibold text-apagado">Seus pontos na semana</p>
            <p className="mt-1 text-4xl font-black tabular-nums">{dados.pontos} XP</p>
            <p className="mt-2 text-base font-bold leading-snug">{textoZona(dados)}</p>
          </section>

          <section>
            <h2 className="text-base font-bold">Seu grupo</h2>
            <p className="mt-1 text-[15px] text-apagado">{textoRegra(dados)}</p>
            <ol className="mt-3 flex flex-col gap-2">
              {dados.linhas.map((linha, i) => {
                const salto = i > 0 && linha.posicao - dados.linhas[i - 1].posicao > 1;
                return (
                  <Fragment key={linha.posicao}>
                    {salto && (
                      <li aria-hidden className="text-center text-lg leading-none text-apagado">
                        ···
                      </li>
                    )}
                    <li
                      className={`${cartao} flex items-center gap-3 py-3 ${linha.eu ? "border-mel bg-mel/10" : ""}`}
                      aria-current={linha.eu ? "true" : undefined}
                    >
                      <span className="w-7 shrink-0 text-center text-lg font-black tabular-nums">{linha.posicao}º</span>
                      <Avatar url={linha.avatar_url} nome={linha.apelido} tamanho={40} />
                      <p className="min-w-0 flex-1 truncate font-bold">{linha.eu ? "Você" : linha.apelido}</p>
                      <span className="shrink-0 font-bold tabular-nums text-apagado">{linha.pontos} XP</span>
                    </li>
                  </Fragment>
                );
              })}
            </ol>
            {textoSemTreino(dados.sem_treino) && (
              <p className="mt-3 text-center text-[15px] text-apagado">{textoSemTreino(dados.sem_treino)}</p>
            )}
          </section>

          <p className="pb-4 text-sm leading-relaxed text-apagado">
            Contam os XP de desafios feitos com a câmera, da respiração guiada e dos amigos que você convidou e já
            treinaram. Modo manual não entra no ranking.
          </p>
        </>
      )}
    </main>
  );
}

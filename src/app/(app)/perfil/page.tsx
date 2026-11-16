import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/componentes/Avatar";
import { botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { Formulario } from "@/componentes/Formulario";
import {
  EQUIPAMENTOS, ESTILOS_MUSICA, faixaEtaria, idade, imc, LIMITACOES, METAS_DIARIAS, NIVEIS_ATIVIDADE, OBJETIVOS, rotuloDe, SEXOS,
} from "@/dominio/perfil";
import { AVISO_MEDICO } from "@/dominio/termos";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { declararLiberacao, sair } from "./acoes";

export const metadata: Metadata = { title: "Perfil · Hive Break" };

const lista = (valores: string[], opcoes: typeof EQUIPAMENTOS, vazio: string) =>
  valores.length ? valores.map((v) => rotuloDe(opcoes, v)).join(", ") : vazio;

export default async function PaginaPerfil() {
  const { perfil, ofensiva, email } = await exigirCadastroCompleto();
  const anos = idade(perfil.data_nascimento!);
  const linhas: [string, string][] = [
    ["Idade", `${anos} anos (faixa ${faixaEtaria(anos)})`],
    ["Sexo", rotuloDe(SEXOS, perfil.sexo)],
    ["Altura", `${perfil.altura_cm} cm`],
    ["Peso", `${Number(perfil.peso_kg).toLocaleString("pt-BR")} kg`],
    ["IMC", imc(perfil.altura_cm!, Number(perfil.peso_kg)).toLocaleString("pt-BR")],
    ["Objetivo", rotuloDe(OBJETIVOS, perfil.objetivo)],
    ["Rotina atual", rotuloDe(NIVEIS_ATIVIDADE, perfil.nivel_atividade)],
    ["Dias por semana", String(perfil.dias_semana)],
    ["Meta diária", rotuloDe(METAS_DIARIAS, perfil.meta_desafios_dia)],
    ["Equipamento em casa", lista(perfil.equipamentos ?? [], EQUIPAMENTOS, "Nenhum")],
    ["Limitações", lista(perfil.limitacoes, LIMITACOES, "Nenhuma")],
    ["Música", rotuloDe(ESTILOS_MUSICA, perfil.musica_estilo)],
    ["Lembrete", perfil.horario_lembrete ? perfil.horario_lembrete.slice(0, 5) : "Sem horário definido"],
  ];
  const estatisticas: [string, string][] = [
    ["Ofensiva", `${ofensiva.atual}`],
    ["Recorde", `${ofensiva.recorde}`],
    ["Protetores", `${ofensiva.protetores}`],
    ["Dificuldade", `${perfil.dificuldade_atual}/10`],
  ];

  return (
    <main className="flex flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-4">
        <Avatar url={perfil.avatar_url} nome={perfil.apelido ?? "?"} tamanho={64} />
        <div className="min-w-0">
          <p className={sobrelinha}>Perfil</p>
          <h1 className="truncate text-3xl font-black leading-tight">{perfil.apelido}</h1>
          <p className="truncate text-sm text-apagado">{email}</p>
        </div>
      </header>

      <dl className="grid grid-cols-4 gap-2">
        {estatisticas.map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-borda bg-superficie px-1 py-3 text-center">
            <dd className="text-xl font-black tabular-nums">{valor}</dd>
            <dt className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-apagado">{rotulo}</dt>
          </div>
        ))}
      </dl>

      {perfil.liberado_alta_intensidade ? (
        perfil.liberacao_declarada_em && (
          <p className={`${cartao} text-[15px] leading-relaxed text-apagado`}>
            Você declarou liberação médica em {new Date(perfil.liberacao_declarada_em).toLocaleDateString("pt-BR", { timeZone: perfil.fuso_horario })}.
            Todos os desafios estão liberados.
          </p>
        )
      ) : (
        <section className={`${cartao} border-atencao/60`}>
          <h2 className="text-lg font-bold leading-tight">Treinos intensos travados por segurança</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-apagado">
            Pela sua triagem, por enquanto você recebe só desafios de baixa intensidade. Se um médico já liberou você,
            confirme abaixo.
          </p>
          <Formulario acao={declararLiberacao} botao="Confirmar liberação" className="mt-3">
            <label className="flex min-h-12 cursor-pointer items-start gap-3">
              <input type="checkbox" name="confirmo" className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--color-mel)]" />
              <span className="text-[15px] leading-relaxed">Meu médico me liberou para exercício intenso.</span>
            </label>
          </Formulario>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Seus dados</h2>
          <p className="text-xs text-apagado">Só você vê altura, peso e triagem</p>
        </div>
        <dl className="mt-2 divide-y divide-borda text-[15px]">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-apagado">{rotulo}</dt>
              <dd className="text-right font-semibold">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-col gap-3">
        <Link href="/perfil/config" className={botaoSecundario}>
          Editar dados e configurações
        </Link>
        <form action={sair}>
          <button type="submit" className="h-12 w-full text-base font-semibold text-apagado underline underline-offset-4">
            Sair da conta
          </button>
        </form>
      </div>
      <p className="pb-2 text-center text-xs leading-relaxed text-apagado">{AVISO_MEDICO}</p>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BotaoGoogle } from "@/app/(publico)/entrar/BotaoGoogle";
import { Assinatura } from "@/componentes/Assinatura";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { FluxoCodigo } from "@/componentes/FluxoCodigo";
import { avisoResultadoNaoSalvo, diasAteApagar, exigirEmailAntesDoDesafio } from "@/dominio/visitante";
import { exigirVisitante, lerEstadoVisitante } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Salvar meu resultado · Hive Break" };

/**
 * Passo 5 do visitante (docs/VISITANTE.md): e-mail → código de 6 dígitos.
 * A conta vira permanente com o mesmo username e o resultado já salvo.
 */
export default async function Salvar({ searchParams }: { searchParams: Promise<{ google?: string; erro?: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const sessao = await exigirVisitante();
  const estado = await lerEstadoVisitante(sessao);
  const { google, erro } = await searchParams;
  const jogou = estado.desafiosConcluidos > 0;
  const antesDeJogar = !jogou && exigirEmailAntesDoDesafio();
  const agora = new Date();
  // Voltou depois (não logo depois do desafio): lembra que o resultado não está salvo.
  const ultimo = estado.ultimoConcluido ? new Date(estado.ultimoConcluido) : null;
  const aviso = ultimo && agora.getTime() - ultimo.getTime() > 30 * 60_000 ? avisoResultadoNaoSalvo(ultimo, agora, sessao.perfil.fuso_horario) : null;
  const dias = diasAteApagar(new Date(sessao.perfil.criado_em), agora);

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-6 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>@{sessao.perfil.username}</p>
        <h1 className="mt-3 text-[2rem] font-black leading-[1.05] text-balance">
          {antesDeJogar ? "Confirme seu e-mail para jogar" : jogou ? "Salvar meu resultado" : "Guarde sua conta"}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-apagado">
          Pra não perder seu resultado e sua sequência, manda um código pro seu e-mail. Sem senha.
        </p>
      </header>

      {aviso && (
        <p role="status" className={`${cartao} border-atencao/60 text-[15px] font-semibold leading-snug`}>
          {aviso} {dias > 0 ? `Ele fica guardado por mais ${dias} ${dias === 1 ? "dia" : "dias"}.` : "Ele será apagado hoje."}
        </p>
      )}
      {google === "existe" && (
        <div role="status" className={`${cartao} flex flex-col gap-3`}>
          <p className="text-[15px] leading-snug">
            Essa conta Google já existe. Entre com ela e seu resultado vai junto. O username @{sessao.perfil.username} é descartado.
          </p>
          <BotaoGoogle pequeno />
        </div>
      )}
      {erro && (
        <p role="alert" className="rounded-xl border border-ruim/50 bg-ruim/10 px-4 py-3 text-[15px]">
          Não deu para concluir com o Google. Tente com o código por e-mail.
        </p>
      )}

      <FluxoCodigo
        fluxoInicial="conversao"
        botao="Mandar código"
        aviso="Você vai receber lembretes curtos. Dá pra desligar quando quiser."
      />

      <div className="mt-auto flex flex-col gap-3">
        {google !== "existe" && <BotaoGoogle modo="visitante" pequeno />}
        {!antesDeJogar && estado.desafio && (
          <Link href={`/desafio/${estado.desafio}`} className={`${botaoSecundario} h-12 text-base`}>
            {jogou ? "Jogar outro desafio antes" : "Fazer o desafio primeiro"}
          </Link>
        )}
        <Assinatura />
      </div>
    </main>
  );
}

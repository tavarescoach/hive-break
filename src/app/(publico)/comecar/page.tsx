import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Assinatura } from "@/componentes/Assinatura";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { sobrelinha } from "@/componentes/estilos";
import { proximoPasso } from "@/dominio/onboarding";
import { COOKIE_CONVITE, normalizarCodigo } from "@/lib/convite";
import { lerSessao, seguirSeLogado } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Comecar } from "./Comecar";

export const metadata: Metadata = { title: "Começar · Hive Break" };

/**
 * Passo 2 do visitante (docs/VISITANTE.md): escolhe o username e faz a
 * declaração de saúde. Sem cadastro, sem senha: joga primeiro, salva depois.
 */
export default async function PaginaComecar({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const sessao = await lerSessao();
  // Conta normal, ou visitante que já começou: segue para onde parou.
  if (sessao && !sessao.perfil.visitante) redirect(proximoPasso(sessao));
  if (sessao?.perfil.username && sessao.perfil.triagem_respondida_em) await seguirSeLogado();

  const { volta } = await searchParams;
  const ref = normalizarCodigo((await cookies()).get(COOKIE_CONVITE)?.value ?? "");
  const quemConvidou = ref
    ? ((await (await criarClienteServidor()).rpc("convite_publico", { p_codigo: ref }).maybeSingle()).data as { apelido: string } | null)
    : null;

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>{quemConvidou ? `Convite de ${quemConvidou.apelido}` : "Hive Break"}</p>
        <h1 className="mt-3 text-[2rem] font-black leading-[1.05] text-balance">Escolha seu username</h1>
        <p className="mt-2 text-base leading-relaxed text-apagado">
          É o nome que aparece na hive, na liga e no placar. Você joga agora e salva o resultado depois, só com o e-mail.
        </p>
      </header>
      <div className="mt-6 flex flex-1 flex-col">
        <Comecar jaVisitante={Boolean(sessao?.perfil.visitante)} volta={volta ?? null} />
      </div>
      <div className="mt-4 flex flex-col items-center gap-3">
        <Link href="/entrar" className="py-2 text-[15px] font-semibold text-apagado underline underline-offset-4">
          Já tenho conta · Entrar
        </Link>
        <Assinatura />
      </div>
    </main>
  );
}

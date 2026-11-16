import { redirect } from "next/navigation";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { proximoPasso } from "@/dominio/onboarding";
import { exigirSessao } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";

/** Leva a pessoa para a tela do cadastro em que ela parou. */
export default async function Onboarding() {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  redirect(proximoPasso(await exigirSessao()));
}

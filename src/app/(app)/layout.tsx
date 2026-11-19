import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { NavInferior } from "@/componentes/NavInferior";
import { PopUpResgate } from "@/componentes/PopUpResgate";
import { perfilHref } from "@/dominio/perfil";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";

/** Área logada: pede login e cadastro completo, e mostra as abas. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const sessao = await exigirCadastroCompleto();
  // Hives na sala ou em andamento (sem a migração da hive, conta zero).
  const { count } = await sessao.supabase
    .from("hives")
    .select("id", { count: "exact", head: true })
    .eq("visibilidade", "aberta")
    .gt("fim_em", new Date().toISOString());
  return (
    <>
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <NavInferior hivesAoVivo={count ?? 0} perfilHref={perfilHref(sessao.perfil.username)} />
      {/* Ao abrir o app, se ainda não viu nenhum pop-up hoje (docs/RESGATE.md, seção 3). */}
      <PopUpResgate />
    </>
  );
}

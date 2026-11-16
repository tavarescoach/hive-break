import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { NavInferior } from "@/componentes/NavInferior";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";

/** Área logada: pede login e cadastro completo, e mostra as 4 abas. */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  await exigirCadastroCompleto();
  return (
    <>
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</div>
      <NavInferior />
    </>
  );
}

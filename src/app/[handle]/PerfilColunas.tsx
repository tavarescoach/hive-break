import { NavInferior } from "@/componentes/NavInferior";
import { MenuDesktop } from "./MenuDesktop";

/**
 * Layout das páginas de perfil (docs/PERFIL.md, seção 1): 3 colunas no
 * computador (≥1024px, breakpoint `lg`), 1 coluna no celular. Sem `perfilHref`
 * (visitante sem login) não há barra de navegação nenhuma.
 */
export function PerfilColunas({
  children,
  direita,
  perfilHref,
  hivesAoVivo = 0,
}: {
  children: React.ReactNode;
  direita?: React.ReactNode;
  perfilHref?: string;
  hivesAoVivo?: number;
}) {
  return (
    <div className={perfilHref ? "pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8" : "pb-8"}>
      <div className="mx-auto flex w-full max-w-[1200px] items-start gap-8 lg:px-6 lg:py-8">
        {perfilHref && (
          <aside className="sticky top-8 hidden w-56 shrink-0 lg:block">
            <MenuDesktop perfilHref={perfilHref} />
          </aside>
        )}
        <main className="min-w-0 flex-1 lg:max-w-[600px]">{children}</main>
        {direita && <aside className="hidden w-[360px] shrink-0 lg:block">{direita}</aside>}
      </div>
      {perfilHref && (
        <div className="lg:hidden">
          <NavInferior hivesAoVivo={hivesAoVivo} perfilHref={perfilHref} />
        </div>
      )}
    </div>
  );
}

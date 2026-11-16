import Link from "next/link";
import { posicaoDoPasso, TOTAL_PASSOS } from "@/dominio/onboarding";

/** Moldura das telas do primeiro acesso: barra de progresso, título e conteúdo. */
export function TelaPasso({
  rota,
  voltar,
  titulo,
  ajuda,
  children,
}: {
  rota: string;
  voltar?: string;
  titulo: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  const posicao = posicaoDoPasso(rota);
  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex h-12 items-center gap-3">
        {voltar ? (
          <Link href={voltar} aria-label="Voltar" className="-ml-3 flex h-12 w-12 items-center justify-center rounded-full text-apagado active:bg-superficie">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
        ) : (
          <span className="w-0" />
        )}
        <div
          role="progressbar"
          aria-label="Progresso do cadastro"
          aria-valuemin={1}
          aria-valuemax={TOTAL_PASSOS}
          aria-valuenow={posicao}
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-superficie-2"
        >
          <div className="h-full rounded-full bg-mel transition-[width] duration-300" style={{ width: `${(posicao / TOTAL_PASSOS) * 100}%` }} />
        </div>
      </div>
      <h1 className="mt-6 text-[1.75rem] font-black leading-tight text-balance">{titulo}</h1>
      {ajuda && <p className="mt-2 text-base leading-relaxed text-apagado">{ajuda}</p>}
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </main>
  );
}

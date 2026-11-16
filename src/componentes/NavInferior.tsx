"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/trilha", rotulo: "Trilha", icone: "M4 19c4-1 4-6 8-7s4-6 8-7M4 19h3M17 5h3" },
  { href: "/liga", rotulo: "Liga", icone: "M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" },
  { href: "/amigos", rotulo: "Amigos", icone: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6.5 6.5 0 0 1 3.5 5.5" },
  { href: "/perfil", rotulo: "Perfil", icone: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0" },
];

/** Barra inferior com as 4 abas do app (seção 4). */
export function NavInferior() {
  const rota = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto grid w-full max-w-[430px] grid-cols-4 border-t border-borda bg-fundo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      {ABAS.map((aba) => {
        const ativa = rota === aba.href || rota.startsWith(`${aba.href}/`);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${ativa ? "text-mel" : "text-apagado"}`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={aba.icone} />
            </svg>
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

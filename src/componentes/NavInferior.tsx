"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/trilha", rotulo: "Trilha", icone: "M4 19c4-1 4-6 8-7s4-6 8-7M4 19h3M17 5h3" },
  { href: "/hive", rotulo: "Hive", icone: "M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5L12 2.5Z" },
  { href: "/liga", rotulo: "Liga", icone: "M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" },
  { href: "/amigos", rotulo: "Amigos", icone: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6.5 6.5 0 0 1 3.5 5.5" },
  { href: "/perfil", rotulo: "Perfil", icone: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0" },
];

/**
 * Barra inferior com as abas do app (seção 4). Quando há hive ao vivo, a aba
 * Hive ganha um ponto amarelo e aparece uma pílula acima da barra.
 */
export function NavInferior({ hivesAoVivo = 0 }: { hivesAoVivo?: number }) {
  const rota = usePathname();
  const naHive = rota === "/hive" || rota.startsWith("/hive/");
  return (
    <>
    {hivesAoVivo > 0 && !naHive && (
      <Link
        href="/hive"
        className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex h-11 w-max items-center gap-2 rounded-full border border-mel/60 bg-superficie px-4 text-sm font-bold text-texto shadow-lg"
      >
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-mel" />
        {hivesAoVivo === 1 ? "1 hive ao vivo agora" : `${hivesAoVivo} hives ao vivo agora`}
        <span className="text-mel">Join ›</span>
      </Link>
    )}
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto grid w-full max-w-[430px] grid-cols-5 border-t border-borda bg-fundo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
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
            <span className="relative">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={aba.icone} />
            </svg>
            {aba.href === "/hive" && hivesAoVivo > 0 && (
              <span aria-label="hive ao vivo" className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-fundo bg-mel" />
            )}
            </span>
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
    </>
  );
}

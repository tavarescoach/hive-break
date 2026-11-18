"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS_FIXOS = [
  { href: "/trilha", rotulo: "Trilha" },
  { href: "/hive", rotulo: "Hive" },
  { href: "/liga", rotulo: "Liga" },
  { href: "/amigos", rotulo: "Amigos" },
];

/** Menu da esquerda no computador (docs/PERFIL.md, seção 1.1). No celular, quem navega é a NavInferior. */
export function MenuDesktop({ perfilHref }: { perfilHref: string }) {
  const rota = usePathname();
  const itens = [...ITENS_FIXOS, { href: perfilHref, rotulo: "Perfil" }, { href: "/perfil/config", rotulo: "Mais" }];
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {itens.map((item) => {
        const ativo = rota === item.href || rota.startsWith(`${item.href}/`) || (item.href.startsWith("/@") && rota.startsWith("/@"));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-xl px-4 py-3 text-base font-bold ${ativo ? "bg-superficie text-mel" : "text-apagado hover:text-texto"}`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { registrarEventoAntesDeIr } from "@/lib/eventos";

const DESTINO = "/comecar";
/** Tempo máximo que a navegação espera pelo evento, antes de ir mesmo assim. */
const ESPERA_MAXIMA_MS = 300;

/**
 * O "Começar" da landing, com o evento comecar_tocado (Etapa 1A). Não é um
 * <Link> comum: a navegação começa junto com o clique, e o navegador cancela
 * um fetch em andamento quando a página troca — então o evento nunca chegava
 * a sair. Aqui o clique espera o evento (ou 300 ms, o que vier primeiro) e só
 * então navega.
 */
export function BotaoComecar({ className }: { className: string }) {
  const router = useRouter();
  const ir = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const espera = new Promise<void>((resolve) => setTimeout(resolve, ESPERA_MAXIMA_MS));
    Promise.race([registrarEventoAntesDeIr("comecar_tocado"), espera]).finally(() => router.push(DESTINO));
  };
  return (
    <a href={DESTINO} className={className} onClick={ir}>
      Começar
    </a>
  );
}

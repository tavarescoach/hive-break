import type { Opcao } from "@/dominio/perfil";
import { opcaoCartao } from "./estilos";

/** Lista de cartões de opção (escolha única ou múltipla), sem JavaScript. */
export function Opcoes({
  nome,
  opcoes,
  atual,
  multipla = false,
  colunas = 1,
}: {
  nome: string;
  opcoes: Opcao<string | number>[];
  atual?: string | number | (string | number)[] | null;
  multipla?: boolean;
  colunas?: 1 | 2 | 3 | 6;
}) {
  const marcada = (valor: string | number) => (Array.isArray(atual) ? atual.includes(valor) : atual === valor);
  const grade = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 6: "grid-cols-6" }[colunas];
  return (
    <div className={`grid gap-2.5 ${grade}`}>
      {opcoes.map((o) => (
        <label key={String(o.valor)} className={`${opcaoCartao} ${colunas > 2 ? "justify-center px-1" : ""}`}>
          <span>
            <span className="block text-lg font-bold leading-tight">{o.rotulo}</span>
            {o.ajuda && <span className="mt-0.5 block text-sm text-apagado">{o.ajuda}</span>}
          </span>
          <input
            type={multipla ? "checkbox" : "radio"}
            name={nome}
            value={String(o.valor)}
            defaultChecked={marcada(o.valor)}
            className={colunas > 2 ? "sr-only" : "h-6 w-6 shrink-0 accent-[var(--color-mel)]"}
          />
        </label>
      ))}
    </div>
  );
}

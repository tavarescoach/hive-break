import type { Metadata } from "next";
import { sobrelinha } from "@/componentes/estilos";
import { TERMO_RESPONSABILIDADE } from "@/dominio/declaracao-saude";
import { ACEITES, AVISO_MEDICO, RESUMO_PRIVACIDADE } from "@/dominio/termos";

export const metadata: Metadata = { title: "Termos e privacidade · Hive Break" };

/** Resumo público dos termos, da privacidade e do termo de responsabilidade (aberto a partir de /comecar). */
export default function Termos() {
  return (
    <main className="flex min-h-dvh flex-col gap-6 px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Hive Break</p>
        <h1 className="mt-3 text-3xl font-black leading-tight">Termos e privacidade</h1>
        <p className="mt-2 text-base text-apagado">O essencial, em linguagem simples.</p>
      </header>
      <ul className="flex flex-col gap-4">
        {RESUMO_PRIVACIDADE.map((item) => (
          <li key={item.titulo}>
            <p className="font-bold leading-tight">{item.titulo}</p>
            <p className="mt-0.5 text-[15px] leading-relaxed text-apagado">{item.texto}</p>
          </li>
        ))}
      </ul>
      <section>
        <h2 className="text-lg font-black">Ao aceitar, você declara que:</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-apagado">
          {ACEITES.map((a) => <li key={a.tipo}>{a.texto}</li>)}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-black">Termo de responsabilidade</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-apagado">
          {TERMO_RESPONSABILIDADE.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
      <p className="text-[15px] leading-relaxed text-apagado">{AVISO_MEDICO}</p>
    </main>
  );
}

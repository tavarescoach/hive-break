import Link from "next/link";
import { botaoPrimario, botaoSecundario, cartao } from "@/componentes/estilos";
import { UNIDADE_META } from "@/dominio/configPerfil";
import { compararSemanas, type DiaMeta } from "@/dominio/vocesDois";

export interface HivesEmComum {
  total: number;
  ultima: string | null;
}

/** "Vocês dois" (docs/PERFIL.md, seção 2.7): só no perfil de amigo. */
export function VocesDois({ nome, meusDias, diasDele, comum }: { nome: string; meusDias: DiaMeta[]; diasDele: DiaMeta[]; comum: HivesEmComum }) {
  const dias = compararSemanas(meusDias, diasDele);
  const maior = Math.max(1, ...dias.flatMap((d) => [d.eu, d.dele]));

  return (
    <section className={`${cartao} flex flex-col gap-4`}>
      <h2 className="text-base font-bold">Vocês dois</h2>

      <div>
        <div className="flex items-center gap-3 text-xs text-apagado">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-mel" /> Você</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-apagado" /> {nome}</span>
        </div>
        <div className="mt-2 flex items-end gap-2" style={{ height: 64 }}>
          {dias.map((d) => (
            <div key={d.dia} className="flex flex-1 items-end justify-center gap-0.5" style={{ height: 64 }}>
              <div className="w-2 rounded-t bg-mel" style={{ height: `${(d.eu / maior) * 100}%` }} />
              <div className="w-2 rounded-t bg-apagado" style={{ height: `${(d.dele / maior) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>

      {comum.total > 0 ? (
        <p className="text-sm text-apagado">
          {comum.total} {UNIDADE_META} {comum.total === 1 ? "feita" : "feitas"} juntos
          {comum.ultima && ` · última em ${new Date(comum.ultima).toLocaleDateString("pt-BR")}`}
        </p>
      ) : (
        <p className="text-[15px] leading-relaxed text-apagado">Vocês nunca fizeram uma hive juntos.</p>
      )}

      <Link href="/hive" className={comum.total > 0 ? botaoSecundario : botaoPrimario}>
        Chamar para uma hive
      </Link>
    </section>
  );
}

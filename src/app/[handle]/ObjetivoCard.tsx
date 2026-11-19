import { cartao } from "@/componentes/estilos";
import { OBJETIVOS, rotuloDe } from "@/dominio/perfil";
import { formatarVariacao } from "@/dominio/peso";
import { ObjetivoDono } from "./ObjetivoDono";

export interface PesoCard {
  papel: "dono" | "outro";
  visivel: boolean;
  atual?: number;
  meta?: number | null;
  inicial?: number;
  desde?: string;
  variacao_kg?: number;
  visibilidade_peso?: "eu" | "variacao" | "tudo";
}

/** Card de objetivo (docs/PERFIL.md, seção 2.3): título + peso, quando houver. */
export function ObjetivoCard({ objetivo, pesoCard, souEu }: { objetivo: string | null; pesoCard: PesoCard | null; souEu: boolean }) {
  const titulo = objetivo ? rotuloDe(OBJETIVOS, objetivo) : "Sem objetivo definido";

  if (souEu) {
    return (
      <section className={`${cartao} flex flex-col gap-3`}>
        <ObjetivoDono titulo={titulo} pesoCard={pesoCard} />
      </section>
    );
  }

  return (
    <section className={`${cartao} flex flex-col gap-3`}>
      <h2 className="text-lg font-black uppercase tracking-tight">🎯 {titulo}</h2>
      <CorpoVisitante pesoCard={pesoCard} />
    </section>
  );
}

function CorpoVisitante({ pesoCard }: { pesoCard: PesoCard | null }) {
  if (!pesoCard?.visivel || pesoCard.variacao_kg == null) return null;
  const { atual, meta, variacao_kg: variacaoKg } = pesoCard;
  return (
    <div className="flex flex-col gap-2">
      {atual != null && (
        <p className="text-xl font-black tabular-nums">
          {atual.toLocaleString("pt-BR")} kg
          {meta != null && <span className="ml-2 text-base font-semibold text-apagado">→ meta {meta.toLocaleString("pt-BR")} kg</span>}
        </p>
      )}
      <p className="text-sm text-apagado">{formatarVariacao(variacaoKg)}</p>
    </div>
  );
}

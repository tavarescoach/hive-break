import Link from "next/link";
import { cartao } from "@/componentes/estilos";
import { HEXAGONO_CLIP } from "@/componentes/hexagono";

export interface DiaCalendario {
  dia: string;
  hives: number;
  bateu_meta: boolean;
  hive_grupo: boolean;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function mesAnterior(ano: number, mes: number) {
  return mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
}
function mesSeguinte(ano: number, mes: number) {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
}

/** Calendário do mês em hexágonos (docs/PERFIL.md, seção 2.6). A semana começa na segunda. */
export function CalendarioHexagonos({
  dias,
  ano,
  mes,
  baseHref,
  hojeIso,
}: {
  dias: DiaCalendario[];
  ano: number;
  mes: number;
  baseHref: string;
  hojeIso: string;
}) {
  if (dias.length === 0) return null;
  const primeiroDiaSemana = (new Date(ano, mes - 1, 1).getDay() + 6) % 7;
  const anterior = mesAnterior(ano, mes);
  const seguinte = mesSeguinte(ano, mes);
  const semFuturo = `${ano}-${String(mes).padStart(2, "0")}` <= hojeIso.slice(0, 7);

  return (
    <section className={`${cartao} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <Link href={`${baseHref}?mes=${anterior.ano}-${String(anterior.mes).padStart(2, "0")}`} aria-label="Mês anterior" className="px-2 py-1 text-apagado">
          ‹
        </Link>
        <p className="text-sm font-bold capitalize">{MESES[mes - 1]} de {ano}</p>
        {semFuturo ? (
          <Link href={`${baseHref}?mes=${seguinte.ano}-${String(seguinte.mes).padStart(2, "0")}`} aria-label="Mês seguinte" className="px-2 py-1 text-apagado">
            ›
          </Link>
        ) : (
          <span className="px-2 py-1 text-borda">›</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: primeiroDiaSemana }).map((_, i) => <span key={`vazio-${i}`} />)}
        {dias.map((d) => {
          const futuro = d.dia > hojeIso;
          const cor = futuro ? "transparent" : d.bateu_meta ? "var(--color-mel)" : d.hives > 0 ? "var(--color-superficie-2)" : "transparent";
          return (
            <span
              key={d.dia}
              title={d.dia}
              style={{
                clipPath: HEXAGONO_CLIP,
                backgroundColor: cor,
                border: futuro ? "1px solid var(--color-borda)" : d.hive_grupo ? "2px solid var(--color-mel)" : "1px solid var(--color-borda)",
              }}
              className="aspect-square w-full"
            />
          );
        })}
      </div>
    </section>
  );
}

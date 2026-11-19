import { cartao } from "@/componentes/estilos";
import { HEXAGONO_CLIP } from "@/componentes/hexagono";
import { proximaConquista, type ProgressoConquista } from "@/dominio/conquistas";
import { EditarVitrine } from "./EditarVitrine";

/**
 * Vitrine de 3 conquistas + a mais perto de bater (docs/PERFIL.md, seção 3.2).
 * `conquistasViewer` só vem no perfil de terceiro: dá o selo "Você ainda não tem".
 */
export function VitrineConquistas({
  conquistas,
  vitrineIds,
  souEu,
  conquistasViewer,
}: {
  conquistas: ProgressoConquista[];
  vitrineIds: string[];
  souEu: boolean;
  conquistasViewer?: ProgressoConquista[] | null;
}) {
  const vitrine = vitrineIds.map((id) => conquistas.find((c) => c.id === id)).filter((c): c is ProgressoConquista => !!c);
  const proxima = souEu ? proximaConquista(conquistas) : null;
  const idsDoViewer = new Set((conquistasViewer ?? []).filter((c) => c.conquistada).map((c) => c.id));

  return (
    <section className={`${cartao} flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">Conquistas</h2>
        {souEu && <EditarVitrine conquistadas={conquistas.filter((c) => c.conquistada)} vitrineAtual={vitrineIds} />}
      </div>

      {vitrine.length === 0 ? (
        <p className="text-sm text-apagado">{souEu ? "Você ainda não escolheu nenhuma conquista para a vitrine." : "Ainda sem conquistas na vitrine."}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {vitrine.map((c) => (
            <li key={c.id} className="flex flex-col items-center gap-1 text-center">
              <span aria-hidden style={{ clipPath: HEXAGONO_CLIP }} className="flex h-14 w-14 items-center justify-center bg-mel/15 text-2xl">
                🏅
              </span>
              <p className="text-xs font-bold leading-tight">{c.nome}</p>
              {conquistasViewer && !idsDoViewer.has(c.id) && <p className="text-[10px] font-semibold text-apagado">Você ainda não tem</p>}
            </li>
          ))}
        </ul>
      )}

      {proxima && (
        <div>
          <p className="text-xs font-semibold text-apagado">
            Próxima: {proxima.nome} ({proxima.atual}/{proxima.meta})
          </p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-superficie-2">
            <div className="h-full rounded-full bg-mel" style={{ width: `${Math.min(100, Math.max(4, ((proxima.atual ?? 0) / (proxima.meta ?? 1)) * 100))}%` }} />
          </div>
        </div>
      )}
    </section>
  );
}

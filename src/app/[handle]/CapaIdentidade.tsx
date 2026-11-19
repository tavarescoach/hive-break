import Link from "next/link";
import { botaoPrimario, botaoSecundario } from "@/componentes/estilos";
import { CORES_DIVISAO, NOMES_DIVISAO, type Divisao } from "@/dominio/liga";

export interface PerfilResumo {
  id: string;
  apelido: string | null;
  avatar_url: string | null;
  username: string;
  divisao_atual: string;
  nivel_atual: number;
  criado_em: string;
  objetivo: string | null;
  meta_desafios_dia: number | null;
  dias_semana: number | null;
}

export type VarianteNoBanner = "proprio" | "visitante_logado" | "publico";

const HEXAGONO = "polygon(25% 2%, 75% 2%, 100% 50%, 75% 98%, 25% 98%, 0% 50%)";

const MEMBRO_DESDE = (criadoEm: string) =>
  new Date(criadoEm).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

/**
 * Capa + identidade (docs/PERFIL.md, seção 2.1 e 2.2). O resto do centro
 * (objetivo, meta da semana, estatísticas...) chega nas próximas etapas.
 */
export function CapaIdentidade({
  perfil,
  variante,
}: {
  perfil: PerfilResumo;
  variante: VarianteNoBanner;
}) {
  const divisao = perfil.divisao_atual as Divisao;
  const corDivisao = CORES_DIVISAO[divisao] ?? CORES_DIVISAO.bronze;
  const nome = perfil.apelido ?? "Hiver";

  return (
    <section className="overflow-hidden rounded-b-3xl lg:rounded-3xl">
      <div
        className="h-28 bg-superficie-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 30%, rgba(255,196,46,0.12), transparent 55%), radial-gradient(circle at 85% 70%, rgba(124,216,232,0.10), transparent 55%)",
        }}
      />
      <div className="flex flex-col gap-4 px-5 pb-5 pt-0">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <span
            aria-hidden
            style={{ clipPath: HEXAGONO, backgroundColor: corDivisao }}
            className="flex h-20 w-20 shrink-0 items-center justify-center"
          >
            <span style={{ clipPath: HEXAGONO }} className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden bg-fundo">
              {perfil.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto pequena vinda do Google
                <img src={perfil.avatar_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-mel">{nome.charAt(0).toUpperCase()}</span>
              )}
            </span>
          </span>
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black leading-tight">{nome}</h1>
          <p className="truncate text-sm text-apagado">@{perfil.username}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-borda px-3 py-1" style={{ color: corDivisao }}>
            {NOMES_DIVISAO[divisao] ?? NOMES_DIVISAO.bronze}
          </span>
          <span className="rounded-full border border-borda px-3 py-1 text-apagado">
            No Hive Break desde {MEMBRO_DESDE(perfil.criado_em)}
          </span>
        </div>

        <AcaoPrincipal variante={variante} nome={nome} />
      </div>
    </section>
  );
}

function AcaoPrincipal({ variante, nome }: { variante: VarianteNoBanner; nome: string }) {
  if (variante === "proprio") {
    return (
      <div className="flex gap-2">
        <Link href="/perfil/config" className={botaoPrimario}>
          Editar perfil
        </Link>
        <Link href="/amigos" className={botaoSecundario}>
          Convidar amigos
        </Link>
      </div>
    );
  }
  if (variante === "visitante_logado") {
    return (
      <Link href="/hive" className={botaoPrimario}>
        Chamar para uma hive
      </Link>
    );
  }
  return (
    <Link href="/entrar" className={botaoPrimario}>
      Treinar com {nome}
    </Link>
  );
}

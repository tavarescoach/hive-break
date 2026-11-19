import { cartao } from "@/componentes/estilos";
import { NumeroAnimado } from "@/componentes/NumeroAnimado";
import { CORES_DIVISAO, NOMES_DIVISAO, type Divisao } from "@/dominio/liga";

export interface EstatisticasPerfil {
  nivel: "dono" | "completo" | "limitado" | "publico";
  ofensiva: number;
  recorde: number;
  divisao: string;
  protetores: number | null;
  xp_total: number | null;
  xp_semana: number | null;
  semana_liga: number | null;
  podios: number | null;
  minutos_total: number | null;
  minutos_semana: number | null;
  hives_grupo: number | null;
}

const CardStat = ({ icone, rotulo, children, rodape }: { icone: React.ReactNode; rotulo: string; children: React.ReactNode; rodape: string }) => (
  <div className={`${cartao} flex flex-col items-center gap-1 text-center`}>
    <span className="text-2xl" aria-hidden>
      {icone}
    </span>
    <p className="text-2xl font-black">{children}</p>
    <p className="text-xs font-semibold uppercase tracking-wide text-apagado">{rotulo}</p>
    <p className="text-xs text-apagado">{rodape}</p>
  </div>
);

/** Grade 2×2 de estatísticas (docs/PERFIL.md, seção 2.5). Terceiros com "esconder XP" só veem ofensiva. */
export function EstatisticasGrid({ dados, treinouHoje }: { dados: EstatisticasPerfil; treinouHoje: boolean }) {
  const completo = dados.nivel === "dono" || dados.nivel === "completo";
  const divisao = dados.divisao as Divisao;
  const corDivisao = CORES_DIVISAO[divisao] ?? CORES_DIVISAO.bronze;

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <CardStat icone={<span className={treinouHoje ? "text-mel" : "text-apagado"}>🔥</span>} rotulo="Ofensiva" rodape={`Recorde ${dados.recorde}`}>
          <NumeroAnimado valor={dados.ofensiva} />
        </CardStat>

        {completo && (
          <>
            <CardStat icone="⚡" rotulo="XP total" rodape={`${(dados.xp_semana ?? 0).toLocaleString("pt-BR")} XP esta semana`}>
              <NumeroAnimado valor={dados.xp_total ?? 0} />
            </CardStat>
            <CardStat icone={<span style={{ color: corDivisao }}>🛡</span>} rotulo="Liga" rodape={`Semana ${dados.semana_liga ?? 0}`}>
              <span style={{ color: corDivisao }}>{NOMES_DIVISAO[divisao] ?? NOMES_DIVISAO.bronze}</span>
            </CardStat>
            <CardStat icone="🏅" rotulo="Pódios" rodape="Top 3 na liga">
              <NumeroAnimado valor={dados.podios ?? 0} />
            </CardStat>
          </>
        )}
      </div>

      {completo && (
        <p className="text-center text-sm text-apagado">
          {dados.minutos_total ?? 0} min no total · {dados.minutos_semana ?? 0} min esta semana · {dados.hives_grupo ?? 0} hives em grupo ·{" "}
          {dados.protetores ?? 0} protetores
        </p>
      )}
    </section>
  );
}

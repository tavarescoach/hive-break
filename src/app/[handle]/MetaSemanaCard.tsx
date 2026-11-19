import { cartao } from "@/componentes/estilos";
import { NOME_STREAK, UNIDADE_META } from "@/dominio/configPerfil";
import { diasComMetaBatida, estadoDoDia, semanaCompleta, type DiaMeta } from "@/dominio/metaSemana";

export interface MetaSemanaDados {
  meta_hives_dia: number;
  meta_dias_semana: number;
  dias: DiaMeta[];
  feitas_na_semana: number;
  streak: number;
}

/** Bloco "Meta da semana" (docs/PERFIL.md, seção 2.4). A semana começa na segunda. */
export function MetaSemanaCard({ dados }: { dados: MetaSemanaDados }) {
  const metaTotal = dados.meta_hives_dia * dados.meta_dias_semana;
  const diasBatidos = diasComMetaBatida(dados.dias, dados.meta_hives_dia);
  const completa = semanaCompleta(dados.dias, dados.meta_hives_dia, dados.meta_dias_semana);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <section className={`${cartao} flex flex-col gap-3 ${completa ? "border-mel/70" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-apagado">
          Meta: {dados.meta_hives_dia} {UNIDADE_META} por dia · {dados.meta_dias_semana} dias na semana
        </p>
        {completa && <span className="rounded-full bg-mel px-2.5 py-0.5 text-xs font-black text-black">Semana completa ✓</span>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-black tabular-nums">
          Esta semana {dados.feitas_na_semana} de {metaTotal} {UNIDADE_META}
        </p>
        <div className="flex gap-1.5" role="img" aria-label={`${diasBatidos} de ${dados.meta_dias_semana} dias com a meta batida`}>
          {dados.dias.map((d) => {
            const estado = estadoDoDia(d.hives, dados.meta_hives_dia);
            const futuro = d.dia > hoje;
            return (
              <span
                key={d.dia}
                aria-hidden
                className={`h-3 w-3 rounded-full ${
                  futuro
                    ? "border border-borda"
                    : estado === "cheia"
                      ? "bg-mel"
                      : estado === "meia"
                        ? "bg-apagado"
                        : "border border-borda"
                }`}
              />
            );
          })}
        </div>
      </div>
      <p className="text-sm text-apagado">
        {diasBatidos} de {dados.meta_dias_semana} dias · 🔥 {dados.streak} dias de {NOME_STREAK.toLowerCase()}
      </p>
    </section>
  );
}

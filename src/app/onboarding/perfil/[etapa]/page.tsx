import { notFound } from "next/navigation";
import { campoTexto, opcaoCartao } from "@/componentes/estilos";
import { Formulario } from "@/componentes/Formulario";
import { Opcoes } from "@/componentes/Opcoes";
import { TelaPasso } from "@/componentes/TelaPasso";
import { ETAPAS_PERFIL } from "@/dominio/perfil";
import { exigirCadastroEmAndamento } from "@/lib/sessao";
import { salvarEtapaPerfil } from "../../acoes";
import { FusoHorario } from "./FusoHorario";

export default async function EtapaPerfil({ params }: { params: Promise<{ etapa: string }> }) {
  const { etapa: id } = await params;
  const indice = ETAPAS_PERFIL.findIndex((e) => e.id === id);
  if (indice < 0) notFound();
  const etapa = ETAPAS_PERFIL[indice];
  const { perfil } = await exigirCadastroEmAndamento();
  const atual = perfil[etapa.campo];
  const anterior = indice > 0 ? `/onboarding/perfil/${ETAPAS_PERFIL[indice - 1].id}` : undefined;
  const hoje = new Date();
  const maximo = `${hoje.getFullYear() - 18}-12-31`;

  return (
    <TelaPasso rota={`/onboarding/perfil/${etapa.id}`} voltar={anterior} titulo={etapa.titulo} ajuda={etapa.ajuda}>
      <Formulario acao={salvarEtapaPerfil.bind(null, etapa.id)} botao="Continuar">
        <FusoHorario />
        {etapa.tipo === "texto" && (
          <input
            name="valor"
            aria-label={etapa.titulo}
            defaultValue={(atual as string | null) ?? perfil.nome?.split(" ")[0] ?? ""}
            minLength={3}
            maxLength={20}
            autoComplete="nickname"
            enterKeyHint="next"
            className={campoTexto}
          />
        )}
        {etapa.tipo === "data" && (
          <input
            type="date"
            name="valor"
            aria-label={etapa.titulo}
            defaultValue={(atual as string | null) ?? ""}
            min="1916-01-01"
            max={maximo}
            autoComplete="bday"
            className={campoTexto}
          />
        )}
        {etapa.tipo === "numero" && (
          <div className="flex items-center gap-3">
            <input
              name="valor"
              aria-label={etapa.titulo}
              defaultValue={atual === null ? "" : Number(atual).toLocaleString("pt-BR", { useGrouping: false })}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              className={`${campoTexto} text-center text-3xl`}
            />
            <span className="w-10 text-xl font-bold text-apagado">{etapa.unidade}</span>
          </div>
        )}
        {etapa.tipo === "escolha" && (
          <Opcoes nome="valor" opcoes={etapa.opcoes!} atual={atual as string | number | null} colunas={etapa.campo === "dias_semana" ? 6 : 1} />
        )}
        {etapa.tipo === "multipla" && (
          <>
            <Opcoes nome="valor" opcoes={etapa.opcoes!} atual={(atual as string[] | null) ?? []} multipla />
            <label className={opcaoCartao}>
              <span className="text-lg font-bold">Nenhum por enquanto</span>
              <input
                type="checkbox"
                name="valor"
                value="nenhum"
                defaultChecked={Array.isArray(atual) && atual.length === 0}
                className="h-6 w-6 shrink-0 accent-[var(--color-mel)]"
              />
            </label>
          </>
        )}
      </Formulario>
    </TelaPasso>
  );
}

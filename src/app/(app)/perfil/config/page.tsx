import type { Metadata } from "next";
import Link from "next/link";
import { botaoSecundario, campoTexto, sobrelinha } from "@/componentes/estilos";
import { Formulario } from "@/componentes/Formulario";
import { Opcoes } from "@/componentes/Opcoes";
import { DIAS_SEMANA, EQUIPAMENTOS, ESTILOS_MUSICA, LIMITACOES, METAS_DIARIAS, OBJETIVOS } from "@/dominio/perfil";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { salvarConfiguracoes } from "../acoes";
import { Lembretes, type PreferenciasLembrete } from "./Lembretes";

export const metadata: Metadata = { title: "Configurações · Hive Break" };

const rotulo = "mb-2 block text-sm font-semibold text-apagado";

export default async function Configuracoes() {
  const { perfil, supabase, usuarioId } = await exigirCadastroCompleto();
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("lembrete,ofensiva,amigos,liga,resumo_semanal,email_ativo,push_ativo")
    .eq("user_id", usuarioId)
    .maybeSingle();
  return (
    <main className="flex flex-col gap-5 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Perfil</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Dados e configurações</h1>
      </header>
      <Formulario acao={salvarConfiguracoes} botao="Salvar">
        <div className="flex flex-col gap-6">
          <label>
            <span className={rotulo}>Apelido</span>
            <input name="apelido" defaultValue={perfil.apelido ?? ""} minLength={3} maxLength={20} className={campoTexto} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={rotulo}>Altura (cm)</span>
              <input name="altura_cm" inputMode="decimal" defaultValue={perfil.altura_cm ?? ""} className={campoTexto} />
            </label>
            <label>
              <span className={rotulo}>Peso (kg)</span>
              <input name="peso_kg" inputMode="decimal" defaultValue={perfil.peso_kg === null ? "" : Number(perfil.peso_kg).toLocaleString("pt-BR")} className={campoTexto} />
            </label>
          </div>
          <fieldset>
            <legend className={rotulo}>Objetivo principal</legend>
            <Opcoes nome="objetivo" opcoes={OBJETIVOS} atual={perfil.objetivo} />
          </fieldset>
          <fieldset>
            <legend className={rotulo}>Dias por semana</legend>
            <Opcoes nome="dias_semana" opcoes={DIAS_SEMANA} atual={perfil.dias_semana} colunas={6} />
          </fieldset>
          <fieldset>
            <legend className={rotulo}>Meta diária</legend>
            <Opcoes nome="meta_desafios_dia" opcoes={METAS_DIARIAS} atual={perfil.meta_desafios_dia} />
          </fieldset>
          <fieldset>
            <legend className={rotulo}>Equipamento em casa</legend>
            <Opcoes nome="equipamentos" opcoes={EQUIPAMENTOS} atual={perfil.equipamentos ?? []} multipla />
          </fieldset>
          <fieldset>
            <legend className={rotulo}>Tenho limitação em</legend>
            <Opcoes nome="limitacoes" opcoes={LIMITACOES} atual={perfil.limitacoes} multipla colunas={2} />
          </fieldset>
          <fieldset>
            <legend className={rotulo}>Música</legend>
            <Opcoes nome="musica_estilo" opcoes={ESTILOS_MUSICA} atual={perfil.musica_estilo} />
          </fieldset>
          <label>
            <span className={rotulo}>Volume da música</span>
            <input type="range" name="volume_musica" min={0} max={100} step={5} defaultValue={perfil.volume_musica} className="h-12 w-full accent-[var(--color-mel)]" />
          </label>
          <label>
            <span className={rotulo}>Volume da voz do treinador</span>
            <input type="range" name="volume_voz" min={0} max={100} step={5} defaultValue={perfil.volume_voz} className="h-12 w-full accent-[var(--color-mel)]" />
          </label>
          {perfil.contagem_preparo_s !== undefined && (
            <fieldset>
              <legend className={rotulo}>Contagem antes de cada exercício</legend>
              <Opcoes
                nome="contagem_preparo_s"
                opcoes={[5, 8, 10].map((v) => ({ valor: v, rotulo: `${v} s` }))}
                atual={perfil.contagem_preparo_s}
                colunas={3}
              />
              <p className="mt-1.5 text-sm text-apagado">Tempo do aviso &quot;Prepare-se&quot; para ler as instruções e se posicionar.</p>
            </fieldset>
          )}
          <label>
            <span className={rotulo}>Horário do lembrete (opcional)</span>
            <input type="time" name="horario_lembrete" defaultValue={perfil.horario_lembrete?.slice(0, 5) ?? ""} className={campoTexto} />
            <span className="mt-1.5 block text-sm text-apagado">
              Vale até o seu primeiro treino. Depois, o lembrete segue o horário em que você costuma treinar.
            </span>
          </label>
          <Link href="/camera" className={botaoSecundario}>
            Reposicionar a câmera
          </Link>
          <Link href="/perfil/username" className={botaoSecundario}>
            {perfil.username ? `Trocar username (@${perfil.username})` : "Criar username"}
          </Link>
          <Link href="/perfil/saude" className={botaoSecundario}>
            Refazer a declaração de saúde
          </Link>
          <p className="text-sm leading-relaxed text-apagado">
            Exportar dados e excluir a conta entram nas próximas versões do teste.
          </p>
        </div>
      </Formulario>
      {prefs && <Lembretes inicial={prefs as PreferenciasLembrete} />}
    </main>
  );
}

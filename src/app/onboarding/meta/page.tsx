import { Formulario } from "@/componentes/Formulario";
import { Opcoes } from "@/componentes/Opcoes";
import { TelaPasso } from "@/componentes/TelaPasso";
import { COMPROMISSOS, METAS_DIARIAS } from "@/dominio/perfil";
import { exigirCadastroEmAndamento } from "@/lib/sessao";
import { salvarMeta } from "../acoes";

export default async function Meta() {
  const sessao = await exigirCadastroEmAndamento();
  return (
    <TelaPasso
      rota="/onboarding/meta"
      voltar="/onboarding/triagem"
      titulo="Quanto você quer treinar por dia?"
      ajuda="Cada desafio leva até 5 minutos. O nível completo fica sempre disponível para os dias com mais tempo."
    >
      <Formulario acao={salvarMeta} botao="Assumir meu compromisso">
        <Opcoes nome="meta" opcoes={METAS_DIARIAS} atual={sessao.perfil.meta_desafios_dia ?? 1} />
        <h2 className="mt-5 text-xl font-black leading-tight">E por quantos dias seguidos?</h2>
        <p className="text-base leading-relaxed text-apagado">
          É a sua primeira meta de ofensiva. Um desafio por dia já mantém a chama acesa.
        </p>
        <Opcoes nome="compromisso" opcoes={COMPROMISSOS} atual={sessao.compromisso ?? 7} />
      </Formulario>
    </TelaPasso>
  );
}

import { TelaDeclaracao } from "@/componentes/TelaDeclaracao";
import { TelaPasso } from "@/componentes/TelaPasso";
import { ETAPAS_PERFIL } from "@/dominio/perfil";
import { exigirCadastroEmAndamento } from "@/lib/sessao";
import { salvarDeclaracao } from "../acoes";

/** Declaração de saúde (docs/VISITANTE.md, seção 4, decisão do Luan de 18/11/2026). */
export default async function Triagem() {
  await exigirCadastroEmAndamento();
  return (
    <TelaPasso
      rota="/onboarding/triagem"
      voltar={`/onboarding/perfil/${ETAPAS_PERFIL[ETAPAS_PERFIL.length - 1].id}`}
      titulo="Antes de treinar: segurança"
      ajuda="Leia as perguntas e responda com sinceridade. Só você vê."
    >
      <TelaDeclaracao acao={salvarDeclaracao} />
    </TelaPasso>
  );
}

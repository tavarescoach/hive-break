import { TelaPasso } from "@/componentes/TelaPasso";
import { ETAPAS_PERFIL } from "@/dominio/perfil";
import { exigirCadastroEmAndamento } from "@/lib/sessao";
import { FormTriagem } from "./FormTriagem";

export default async function Triagem() {
  await exigirCadastroEmAndamento();
  return (
    <TelaPasso
      rota="/onboarding/triagem"
      voltar={`/onboarding/perfil/${ETAPAS_PERFIL[ETAPAS_PERFIL.length - 1].id}`}
      titulo="7 perguntas rápidas de segurança"
      ajuda="Responda com sinceridade. Só você vê as respostas."
    >
      <FormTriagem />
    </TelaPasso>
  );
}

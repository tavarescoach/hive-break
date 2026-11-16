import { Formulario } from "@/componentes/Formulario";
import { Opcoes } from "@/componentes/Opcoes";
import { TelaPasso } from "@/componentes/TelaPasso";
import { ESTILOS_MUSICA } from "@/dominio/perfil";
import { exigirCadastroEmAndamento } from "@/lib/sessao";
import { salvarMusica } from "../acoes";

export default async function Musica() {
  const sessao = await exigirCadastroEmAndamento();
  return (
    <TelaPasso
      rota="/onboarding/musica"
      voltar="/camera"
      titulo="Que som combina com o seu treino?"
      ajuda="Dá para trocar quando quiser. A música baixa sozinha quando o treinador fala."
    >
      <Formulario acao={salvarMusica} botao="Ver minha trilha">
        <Opcoes nome="estilo" opcoes={ESTILOS_MUSICA} atual={sessao.perfil.musica_estilo ?? "eletronica"} />
      </Formulario>
    </TelaPasso>
  );
}

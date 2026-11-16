import type { Metadata } from "next";
import { ConfiguracaoPendente } from "@/componentes/ConfiguracaoPendente";
import { TelaPasso } from "@/componentes/TelaPasso";
import { exigirSessao } from "@/lib/sessao";
import { supabaseConfigurado } from "@/lib/supabase/env";
import { destinoDepoisDaCamera } from "../onboarding/acoes";
import { ConfigCamera } from "./ConfigCamera";

export const metadata: Metadata = { title: "Câmera · Hive Break" };

export default async function Camera() {
  if (!supabaseConfigurado) return <ConfiguracaoPendente />;
  const sessao = await exigirSessao();
  const destino = await destinoDepoisDaCamera();
  const noCadastro = !sessao.perfil.onboarding_concluido_em;
  return (
    <TelaPasso
      rota="/camera"
      voltar={noCadastro ? "/onboarding/meta" : "/perfil/config"}
      titulo="Vamos posicionar a câmera"
      ajuda="A câmera frontal é o seu treinador: ela precisa ver seu corpo inteiro."
    >
      <ConfigCamera destino={destino} />
    </TelaPasso>
  );
}

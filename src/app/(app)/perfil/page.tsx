import { redirect } from "next/navigation";
import { exigirCadastroCompleto } from "@/lib/sessao";

/** /perfil é só um atalho antigo: o perfil de verdade mora em /@username (docs/PERFIL.md). */
export default async function PaginaPerfil() {
  const { perfil } = await exigirCadastroCompleto();
  redirect(`/@${perfil.username}`);
}

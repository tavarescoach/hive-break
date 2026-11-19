import type { Metadata } from "next";
import Link from "next/link";
import { botaoSecundario, cartao, sobrelinha } from "@/componentes/estilos";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { origemAbsoluta } from "@/lib/origem";
import { buscarSugestoes } from "./acoes";
import { AtalhosPerfil } from "./AtalhosPerfil";
import { BuscaAmigos } from "./BuscaAmigos";

export const metadata: Metadata = { title: "Buscar amigos · Hive Break" };

export default async function BuscarAmigos() {
  const sessao = await exigirCadastroCompleto();
  const [sugestoes, origem] = await Promise.all([buscarSugestoes(), origemAbsoluta()]);

  return (
    <main className="flex flex-col gap-6 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Amigos</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Buscar amigos</h1>
      </header>
      {sessao.perfil.username ? (
        <AtalhosPerfil link={`${origem}/@${sessao.perfil.username}`} />
      ) : (
        <div className={`${cartao} flex flex-col gap-2`}>
          <p className="text-[15px] leading-relaxed text-apagado">
            Escolha um username para ter um link e QR code do seu perfil.
          </p>
          <Link href="/perfil/username" className={botaoSecundario}>
            Criar username
          </Link>
        </div>
      )}
      <BuscaAmigos sugestoesIniciais={sugestoes} />
    </main>
  );
}

import type { Metadata } from "next";
import { campoTexto, sobrelinha } from "@/componentes/estilos";
import { Formulario } from "@/componentes/Formulario";
import { exigirCadastroCompleto } from "@/lib/sessao";
import { trocarUsername } from "../acoes";

export const metadata: Metadata = { title: "Username · Hive Break" };

/** Trocar o username, no máximo 1 vez a cada 30 dias (docs/VISITANTE.md, seção 5). */
export default async function Username() {
  const { perfil } = await exigirCadastroCompleto();
  const trocado = perfil.username_trocado_em ? new Date(perfil.username_trocado_em) : null;
  const liberaEm = trocado ? new Date(trocado.getTime() + 30 * 86_400_000) : null;
  const bloqueado = Boolean(perfil.username && liberaEm && liberaEm > new Date());
  return (
    <main className="flex min-h-[80dvh] flex-col gap-4 px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Perfil</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">Username</h1>
        <p className="mt-2 text-base leading-relaxed text-apagado">
          {bloqueado && liberaEm
            ? `Você trocou há pouco. A próxima troca fica liberada em ${liberaEm.toLocaleDateString("pt-BR")}.`
            : "Letras, números, ponto e sublinhado, de 3 a 20. Dá para trocar 1 vez a cada 30 dias."}
        </p>
      </header>
      <Formulario acao={trocarUsername} botao="Salvar">
        <label>
          <span className="mb-2 block text-sm font-semibold text-apagado">Novo username</span>
          <input
            name="username"
            defaultValue={perfil.username ?? ""}
            minLength={3}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={bloqueado}
            className={campoTexto}
          />
        </label>
      </Formulario>
    </main>
  );
}

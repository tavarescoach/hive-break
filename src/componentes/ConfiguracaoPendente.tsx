import Link from "next/link";
import { botaoSecundario, sobrelinha } from "./estilos";

/** Aparece enquanto as variáveis do Supabase não foram configuradas na Vercel. */
export function ConfiguracaoPendente() {
  return (
    <main className="flex min-h-dvh flex-col justify-center gap-5 px-5">
      <p className={sobrelinha}>Hive Break</p>
      <h1 className="text-3xl font-black leading-tight">Falta ligar o banco de dados</h1>
      <p className="text-base leading-relaxed text-apagado">
        O login e o cadastro precisam do projeto Supabase. Defina as variáveis{" "}
        <code className="text-texto">NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
        <code className="text-texto">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> na Vercel e publique de novo. O passo a
        passo está em <code className="text-texto">docs/CONFIGURACAO.md</code>.
      </p>
      <Link href="/teste-tecnico" className={botaoSecundario}>
        Abrir o teste técnico da câmera
      </Link>
    </main>
  );
}

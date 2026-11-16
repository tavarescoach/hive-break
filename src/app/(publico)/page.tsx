import Link from "next/link";
import { Assinatura } from "@/componentes/Assinatura";
import { botaoPrimario, sobrelinha } from "@/componentes/estilos";
import { seguirSeLogado } from "@/lib/sessao";

const BENEFICIOS = [
  { titulo: "5 minutos já contam", texto: "Faça um desafio por dia, ou o treino completo quando der." },
  { titulo: "A câmera conta por você", texto: "Ela valida cada repetição, corrige a postura e dá nota." },
  { titulo: "Sem equipamento para começar", texto: "Os primeiros níveis só pedem um pouco de espaço." },
];

export default async function Landing() {
  await seguirSeLogado();
  return (
    <main className="flex min-h-dvh flex-col gap-10 px-5 pb-8 pt-[max(3rem,env(safe-area-inset-top))]">
      <header>
        <p className={sobrelinha}>Hive Break</p>
        <h1 className="mt-3 text-[2.6rem] font-black leading-[1.02] text-balance">
          Um desafio de 5 minutos por dia.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-apagado">
          Com um treinador na câmera que conta, corrige e pontua cada repetição.
        </p>
      </header>

      <ul className="flex flex-col gap-5">
        {BENEFICIOS.map((b, i) => (
          <li key={b.titulo} className="flex gap-4">
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mel/15 text-lg font-black text-mel">
              {i + 1}
            </span>
            <div>
              <p className="text-lg font-bold leading-tight">{b.titulo}</p>
              <p className="mt-0.5 text-[15px] leading-relaxed text-apagado">{b.texto}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-4">
        <Link href="/entrar" className={botaoPrimario}>
          Começar
        </Link>
        <p className="text-center text-xs leading-relaxed text-apagado">
          A câmera é processada no seu aparelho. Nenhuma imagem ou vídeo é gravado ou enviado.
        </p>
        <Assinatura />
      </div>
    </main>
  );
}

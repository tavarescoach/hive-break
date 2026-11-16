import Link from "next/link";

export default function Inicio() {
  return (
    <main className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mel">Hive Break</p>
        <h1 className="mt-3 text-4xl font-black leading-[1.05] text-balance">
          5 minutos por dia, com um treinador na câmera.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-apagado">
          Estamos na Fase 0: o teste técnico da contagem de repetições pela câmera frontal. O resto do app vem
          depois que a contagem for aprovada.
        </p>
      </div>
      <div>
        <Link
          href="/teste-tecnico"
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-mel text-lg font-bold text-black active:bg-mel-forte"
        >
          Abrir o teste técnico
        </Link>
        <p className="mt-4 text-center text-xs leading-relaxed text-apagado">
          A câmera é processada no seu aparelho. Nenhuma imagem ou vídeo é gravado ou enviado.
        </p>
      </div>
    </main>
  );
}

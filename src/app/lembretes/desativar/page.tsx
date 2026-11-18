import type { Metadata } from "next";
import { Desativar } from "./Desativar";

export const metadata: Metadata = { title: "Desativar lembretes · Hive Break", robots: { index: false } };

/** Link do rodapé dos e-mails: desativa sem login, pelo token assinado. */
export default async function PaginaDesativar({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <Desativar token={typeof token === "string" ? token : ""} />
    </main>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hive Break",
  description: "Um desafio de 5 minutos por dia, com um treinador na câmera que conta, corrige e pontua cada repetição.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0e11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {/* Mobile first: no desktop o app aparece centralizado em coluna de celular. */}
        <div className="mx-auto min-h-dvh w-full max-w-[430px]">{children}</div>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, Rubik } from "next/font/google";
import "./globals.css";

// HUD de treino (docs/HUD_TREINO.md): Inter 900 nos números, Rubik nos rótulos.
const inter = Inter({ subsets: ["latin"], weight: "900", variable: "--font-inter" });
const rubik = Rubik({ subsets: ["latin"], weight: ["500", "800", "900"], variable: "--font-rubik" });

export const metadata: Metadata = {
  title: "Hive Break",
  description: "Um desafio de 5 minutos por dia, com um treinador na câmera que conta, corrige e pontua cada repetição.",
  applicationName: "Hive Break",
  // Na tela inicial do iPhone: nome curto e abre em tela cheia. O ícone vem de src/app/apple-icon.png.
  appleWebApp: { capable: true, title: "Hive Break", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0e11",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${rubik.variable}`}>
      <body>
        {/* Mobile first: no desktop o app aparece centralizado em coluna de celular. */}
        <div className="mx-auto min-h-dvh w-full max-w-[430px]">{children}</div>
      </body>
    </html>
  );
}

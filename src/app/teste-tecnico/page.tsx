import type { Metadata } from "next";
import { TesteTecnico } from "./TesteTecnico";

export const metadata: Metadata = {
  title: "Teste técnico · Hive Break",
  robots: { index: false },
};

export default function Pagina() {
  return <TesteTecnico />;
}

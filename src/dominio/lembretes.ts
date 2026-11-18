/** Categorias de lembrete que a pessoa liga e desliga (FUNIL_LEMBRETES.md, seção 2). */
export const CATEGORIAS_LEMBRETE = [
  { campo: "lembrete", rotulo: "Lembrete diário", descricao: "No horário em que você costuma treinar." },
  { campo: "ofensiva", rotulo: "Ofensiva", descricao: "Às 20h e 22h, quando a sequência está em risco, e nos marcos." },
  { campo: "amigos", rotulo: "Amigos e hive", descricao: "Hive começando, high fives, amigos que entraram ou voltaram." },
  { campo: "liga", rotulo: "Liga", descricao: "Quando um amigo passa você na liga." },
  { campo: "resumo_semanal", rotulo: "Resumo semanal", descricao: "Sábado de manhã, por e-mail." },
] as const;

export type CategoriaLembrete = (typeof CATEGORIAS_LEMBRETE)[number]["campo"];

export const ROTULO_CATEGORIA: Record<string, string> = {
  ...Object.fromEntries(CATEGORIAS_LEMBRETE.map((c) => [c.campo, c.rotulo.toLowerCase()])),
  todos: "todos os tipos",
};

/** "15h", "15h20": o mesmo formato dos textos dos lembretes. */
export function horaCurta(data: Date): string {
  const m = data.getMinutes();
  return `${data.getHours()}h${m ? String(m).padStart(2, "0") : ""}`;
}

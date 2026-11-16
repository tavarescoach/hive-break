/**
 * Triagem de segurança: PAR-Q+ simplificado, 7 perguntas de sim ou não
 * (seção 3.1, passo 5). Qualquer "sim" limita a pessoa a desafios de baixa
 * intensidade até ela declarar que foi liberada por um médico.
 *
 * Os textos seguem as 7 perguntas gerais do PAR-Q+ e precisam de revisão
 * técnica antes do lançamento.
 */
export const PERGUNTAS_TRIAGEM = [
  { id: "q1", texto: "Algum médico já disse que você tem um problema de coração ou pressão alta?" },
  { id: "q2", texto: "Você sente dor no peito em repouso, nas atividades do dia a dia ou quando faz exercício?" },
  { id: "q3", texto: "Você perde o equilíbrio por tontura ou desmaiou nos últimos 12 meses?" },
  { id: "q4", texto: "Você tem alguma outra doença crônica diagnosticada, além de problema de coração ou pressão alta?" },
  { id: "q5", texto: "Você toma remédio receitado para alguma doença crônica?" },
  { id: "q6", texto: "Você tem, ou teve nos últimos 12 meses, um problema de osso, articulação, músculo, ligamento ou tendão que pode piorar com exercício?" },
  { id: "q7", texto: "Algum médico já disse que você só deve fazer exercício com acompanhamento médico?" },
] as const;

export const MODALIDADES_BAIXA_INTENSIDADE = ["mobilidade", "alongamento", "yoga", "equilibrio", "respiracao"];

export function lerRespostas(formulario: FormData): Record<string, boolean> | null {
  const respostas: Record<string, boolean> = {};
  for (const { id } of PERGUNTAS_TRIAGEM) {
    const valor = formulario.get(id);
    if (valor !== "sim" && valor !== "nao") return null;
    respostas[id] = valor === "sim";
  }
  return respostas;
}

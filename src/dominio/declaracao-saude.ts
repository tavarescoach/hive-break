/**
 * Declaração de saúde antes do 1º desafio (docs/VISITANTE.md, seção 4, com a
 * decisão do Luan de 18/11/2026): em vez de responder uma a uma, a pessoa
 * declara que responde NÃO a todas as perguntas do questionário de prontidão
 * e confirma o termo de responsabilidade. São dois pop-ups rápidos; o uso só
 * é liberado depois de confirmar os dois.
 *
 * Quem não pode declarar NÃO fica só com respiração e mobilidade leve
 * (trilha_estados, migração 20261122000100). A pessoa pode refazer em
 * /perfil/saude.
 *
 * Textos a revisar com o jurídico antes do lançamento.
 */
export const VERSAO_DECLARACAO = "2026-11-18";

export const PERGUNTAS_PRONTIDAO = [
  "Você sente dor no peito quando faz esforço físico?",
  "Você já desmaiou ou sentiu tontura forte durante exercício?",
  "Algum profissional de saúde já pediu para você evitar exercício?",
] as const;

export const TEXTO_DECLARACAO = "Declaro que respondo NÃO a todas as perguntas acima.";

export const TEXTO_RESTRICAO =
  "Antes de começar, vale conversar com um profissional de saúde. Por enquanto, vamos com respiração e alongamento leve.";

export const TERMO_RESPONSABILIDADE = [
  "Declaro que as informações que dei são verdadeiras e que estou ciente de que sou o único responsável pela minha integridade física e pela minha segurança durante os desafios.",
  "O Hive Break é um jogo de atividade física e não substitui avaliação nem acompanhamento de um profissional de saúde. O app não se responsabiliza por lesões, mal-estar ou qualquer dano decorrente da prática.",
  "Vou parar na hora se sentir dor, tontura, falta de ar fora do normal ou qualquer mal-estar, e vou procurar um profissional de saúde.",
  "Vou treinar num espaço seguro, livre de obstáculos, e respeitar os meus limites.",
] as const;

export const TEXTO_CIENTE = "Li e estou ciente";

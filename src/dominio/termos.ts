/**
 * Textos de aceite (seção 3.1, passo 3, e seção 12.3). A versão é gravada em
 * cada aceite. RASCUNHO: precisa de revisão jurídica antes do lançamento.
 */
export const VERSAO_TERMOS = "2026-11-rascunho-1";

export const RESUMO_PRIVACIDADE = [
  { titulo: "A câmera fica no seu aparelho", texto: "O vídeo é analisado no próprio celular. Nenhuma imagem ou vídeo é gravado ou enviado." },
  { titulo: "Só números saem do celular", texto: "Guardamos repetições, tempos e notas dos seus desafios. Nada de fotos, vídeos ou pontos do corpo." },
  { titulo: "Seus dados de saúde são só seus", texto: "Altura, peso, triagem e relatos de dor nunca aparecem para outras pessoas. No ranking aparecem só apelido, foto e divisão." },
  { titulo: "Você manda nos seus dados", texto: "Dá para exportar tudo ou excluir a conta pelo próprio app, quando quiser." },
];

export const ACEITES = [
  { tipo: "termos", texto: "Li e aceito os termos de uso." },
  { tipo: "privacidade", texto: "Li e aceito a política de privacidade." },
  { tipo: "dados_saude", texto: "Autorizo o uso dos meus dados de saúde (altura, peso, triagem e relatos de dor) para personalizar os treinos e cuidar da minha segurança." },
] as const;

export const AVISO_MEDICO = "O Hive Break não substitui avaliação médica nem acompanhamento profissional.";

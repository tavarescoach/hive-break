import { ETAPAS_PERFIL, type Perfil } from "./perfil";

export const TIPOS_ACEITE = ["termos", "privacidade", "dados_saude"] as const;

/** O que já foi preenchido, lido do banco. */
export interface EstadoOnboarding {
  perfil: Perfil;
  aceites: string[];
  fezTriagem: boolean;
  compromisso: number | null;
}

/**
 * Próxima tela do primeiro acesso (seção 3.1): termos → perfil em etapas →
 * triagem → meta e compromisso → câmera → música → trilha.
 * O nivelamento entra depois da música na Fase 3.
 */
export function proximoPasso(estado: EstadoOnboarding): string {
  const { perfil } = estado;
  if (perfil.onboarding_concluido_em) return "/trilha";
  if (TIPOS_ACEITE.some((tipo) => !estado.aceites.includes(tipo))) return "/onboarding/termos";
  const etapa = ETAPAS_PERFIL.find((e) => perfil[e.campo] === null || perfil[e.campo] === undefined);
  if (etapa) return `/onboarding/perfil/${etapa.id}`;
  if (!estado.fezTriagem) return "/onboarding/triagem";
  if (perfil.meta_desafios_dia === null || estado.compromisso === null) return "/onboarding/meta";
  if (perfil.musica_estilo === null) return "/camera";
  return "/onboarding/musica";
}

/** Total de telas do onboarding, para a barra de progresso. */
export const TOTAL_PASSOS = 1 + ETAPAS_PERFIL.length + 4;

/** Posição (a partir de 1) de cada tela na barra de progresso. */
export function posicaoDoPasso(rota: string): number {
  if (rota.startsWith("/onboarding/termos")) return 1;
  const etapa = ETAPAS_PERFIL.findIndex((e) => rota === `/onboarding/perfil/${e.id}`);
  if (etapa >= 0) return 2 + etapa;
  const base = 1 + ETAPAS_PERFIL.length;
  if (rota.startsWith("/onboarding/triagem")) return base + 1;
  if (rota.startsWith("/onboarding/meta")) return base + 2;
  if (rota.startsWith("/camera")) return base + 3;
  return base + 4;
}

/**
 * Modelo da tela Trilha: Seção (nível) → Unidade → itens do caminho
 * (desafios, baús de XP e o desafio da unidade).
 *
 * Os estados dos desafios vêm prontos do servidor (função ler_trilha). Aqui
 * só se monta o caminho para desenhar: onde entram os baús, o zigue-zague,
 * qual é o item atual e o progresso de cada seção.
 */

export type EstadoDesafio = "concluido" | "disponivel" | "bloqueado" | "travado";

export interface DesafioTrilha {
  id: string;
  unit_id: string;
  level_id: number;
  ordem: number;
  titulo: string;
  modalidade: string;
  duracao_s: number;
  intensidade: "baixa" | "media" | "alta";
  equipamento: string | null;
  tipo: "desafio" | "final";
  xp: number;
  estado: EstadoDesafio;
}

export interface DadosTrilha {
  nivel_atual: number;
  liberado_alta_intensidade: boolean;
  ofensiva: number;
  fez_hoje: boolean;
  xp_hoje: number;
  meta_xp: number;
  niveis: { id: number; ordem: number; tema: string; equipamentos: string[]; liberado: boolean; concluido: boolean }[];
  unidades: { id: string; level_id: number; ordem: number; titulo: string; descricao: string | null }[];
  desafios: DesafioTrilha[];
  baus_abertos: { unit_id: string; posicao: number }[];
}

export type ItemCaminho =
  | { tipo: "desafio" | "final"; chave: string; desafio: DesafioTrilha; deslocamento: number; atual: boolean }
  | { tipo: "bau"; chave: string; unidade: string; posicao: number; estado: "aberto" | "disponivel" | "bloqueado"; deslocamento: number; atual: false };

type ItemSemPosicao = ItemCaminho extends infer I ? (I extends ItemCaminho ? Omit<I, "deslocamento"> : never) : never;

export interface UnidadeCaminho {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  itens: ItemCaminho[];
}

export interface SecaoCaminho {
  id: number;
  ordem: number;
  tema: string;
  equipamentos: string[];
  liberada: boolean;
  concluida: boolean;
  /** Desafios concluídos e total (sem contar baús). */
  feitos: number;
  total: number;
  unidades: UnidadeCaminho[];
}

export interface Caminho {
  secoes: SecaoCaminho[];
  /** Chave do item atual (o hexágono que pulsa), ou null se não há nada a fazer. */
  atual: string | null;
}

export const XP_BAU = 10;
/** Um baú de XP a cada 4 desafios da unidade. */
export const INTERVALO_BAU = 4;

/** Zigue-zague: posição horizontal de cada item, em passos (−2 a 2). */
const ZIGUE_ZAGUE = [0, 1, 2, 1, 0, -1, -2, -1];

export function montarCaminho(dados: DadosTrilha): Caminho {
  const abertos = new Set(dados.baus_abertos.map((b) => `${b.unit_id}:${b.posicao}`));
  // Item atual: o primeiro disponível da seção atual; se não houver, o primeiro disponível de qualquer seção.
  const disponiveis = dados.desafios.filter((d) => d.estado === "disponivel");
  const atual = (disponiveis.find((d) => d.level_id === dados.nivel_atual) ?? disponiveis[0])?.id ?? null;

  const secoes = dados.niveis.map((nivel): SecaoCaminho => {
    const daSecao = dados.desafios.filter((d) => d.level_id === nivel.id);
    // Há algo pendente (disponível ou bloqueado) até este ponto da seção?
    let pendente = false;
    const unidades = dados.unidades
      .filter((u) => u.level_id === nivel.id)
      .map((unidade): UnidadeCaminho => {
        const itens: ItemCaminho[] = [];
        let posicao = 0;
        const adicionar = (item: ItemSemPosicao) => {
          itens.push({ ...item, deslocamento: ZIGUE_ZAGUE[posicao++ % ZIGUE_ZAGUE.length] } as ItemCaminho);
        };
        for (const desafio of daSecao.filter((d) => d.unit_id === unidade.id)) {
          adicionar({ tipo: desafio.tipo, chave: desafio.id, desafio, atual: desafio.id === atual });
          if (desafio.estado === "disponivel" || desafio.estado === "bloqueado") pendente = true;
          if (desafio.tipo === "desafio" && desafio.ordem % INTERVALO_BAU === 0) {
            const chave = `${unidade.id}:${desafio.ordem}`;
            adicionar({
              tipo: "bau",
              chave: `bau:${chave}`,
              unidade: unidade.id,
              posicao: desafio.ordem,
              estado: abertos.has(chave) ? "aberto" : nivel.liberado && !pendente ? "disponivel" : "bloqueado",
              atual: false,
            });
          }
        }
        return { id: unidade.id, ordem: unidade.ordem, titulo: unidade.titulo, descricao: unidade.descricao, itens };
      });
    return {
      id: nivel.id,
      ordem: nivel.ordem,
      tema: nivel.tema,
      equipamentos: nivel.equipamentos,
      liberada: nivel.liberado,
      concluida: nivel.concluido,
      feitos: daSecao.filter((d) => d.estado === "concluido").length,
      total: daSecao.length,
      unidades,
    };
  });

  return { secoes, atual };
}

export function formatarDuracao(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  if (minutos === 0) return `${resto} s`;
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`;
}

export const ROTULO_MODALIDADE: Record<string, string> = {
  aquecimento: "Aquecimento",
  mobilidade: "Mobilidade",
  equilibrio: "Equilíbrio",
  precisao: "Precisão e coordenação",
  forca: "Força",
  core: "CORE",
  condicionamento: "Condicionamento",
  hiit: "HIIT",
  yoga: "Yoga e alongamento",
  respiracao: "Volta à calma",
  desafio_final: "Desafio da unidade",
};

export const ROTULO_EQUIPAMENTO: Record<string, string> = { tapete: "Tapete", cabo_vassoura: "Cabo de vassoura" };

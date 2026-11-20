import type { ExercicioMetodo } from "@/dominio/metodos";
import type { DefinicaoExercicio } from "@/motor/tipos";
import abducao_em_pe from "./abducao_em_pe.json";
import aviao from "./aviao.json";
import cadeira_parede from "./cadeira_parede.json";
import inclinacao_lateral_em_pe from "./inclinacao_lateral_em_pe.json";
import joelho_cotovelo_cruzado from "./joelho_cotovelo_cruzado.json";
import joelhos_peito_cadeira from "./joelhos_peito_cadeira.json";
import pallof_em_pe from "./pallof_em_pe.json";
import prancha_mesa from "./prancha_mesa.json";
import sentar_levantar_uma_perna from "./sentar_levantar_uma_perna.json";
import stiff_kickstand from "./stiff_kickstand.json";
import stiff_unilateral from "./stiff_unilateral.json";
import afundo_alternado from "./afundo_alternado.json";
import agachamento_bastao from "./agachamento_bastao.json";
import agachamento_livre from "./agachamento_livre.json";
import agachamento_parcial_cadeira from "./agachamento_parcial_cadeira.json";
import alongamento_posterior from "./alongamento_posterior.json";
import apoio_uma_perna from "./apoio_uma_perna.json";
import apoio_uma_perna_com_toque from "./apoio_uma_perna_com_toque.json";
import bom_dia from "./bom_dia.json";
import bom_dia_bastao from "./bom_dia_bastao.json";
import cachorro_olhando_baixo from "./cachorro_olhando_baixo.json";
import elevacao_bracos_y from "./elevacao_bracos_y.json";
import flexao_braco from "./flexao_braco.json";
import flexao_joelhos from "./flexao_joelhos.json";
import guerreiro_2 from "./guerreiro_2.json";
import marcha_estacionaria from "./marcha_estacionaria.json";
import mountain_climber from "./mountain_climber.json";
import polichinelo from "./polichinelo.json";
import polichinelo_sem_salto from "./polichinelo_sem_salto.json";
import ponte_gluteo from "./ponte_gluteo.json";
import postura_arvore from "./postura_arvore.json";
import prancha from "./prancha.json";
import respiracao_guiada from "./respiracao_guiada.json";
import skipping from "./skipping.json";
import toque_alvos from "./toque_alvos.json";

/**
 * Catálogo de exercícios (seção 7). Cada um é só um arquivo de dados lido pelo
 * motor. Os 3 primeiros foram testados com pessoas na Fase 0; os demais usam os
 * valores iniciais da especificação e ainda precisam de calibração (inclusive
 * os 4 da Etapa 1A: as variações fáceis referenciadas por `variacao_facil`
 * que ainda não existiam no motor).
 */
export const EXERCICIOS = [
  agachamento_livre,
  polichinelo,
  apoio_uma_perna,
  afundo_alternado,
  flexao_braco,
  ponte_gluteo,
  prancha,
  skipping,
  mountain_climber,
  elevacao_bracos_y,
  alongamento_posterior,
  marcha_estacionaria,
  guerreiro_2,
  postura_arvore,
  cachorro_olhando_baixo,
  toque_alvos,
  respiracao_guiada,
  agachamento_bastao,
  bom_dia_bastao,
  agachamento_parcial_cadeira,
  flexao_joelhos,
  polichinelo_sem_salto,
  apoio_uma_perna_com_toque,
  bom_dia,
  // Etapa 1C-A: biblioteca (ABS e GLU) para o Modo Escritório (docs/TRILHA_ESC_V2.md §6.2).
  abducao_em_pe,
  aviao,
  cadeira_parede,
  inclinacao_lateral_em_pe,
  joelho_cotovelo_cruzado,
  joelhos_peito_cadeira,
  pallof_em_pe,
  prancha_mesa,
  sentar_levantar_uma_perna,
  stiff_kickstand,
  stiff_unilateral,
] as unknown as DefinicaoExercicio[];

/** Exercícios do teste técnico da Fase 0. */
export const EXERCICIOS_TESTADOS = EXERCICIOS.slice(0, 3);

export function exercicioPorId(id: string): DefinicaoExercicio | undefined {
  return EXERCICIOS.find((e) => e.id === id);
}

const SUSTENTACAO = new Set(["isometria", "postura", "equilibrio", "respiracao"]);

/** Exercício de sustentação: mede tempo na posição, não repetições. */
export const ehSustentacao = (def: DefinicaoExercicio) => SUSTENTACAO.has(def.formato);

/** O que o método do desafio precisa saber do exercício. */
export function paraMetodo(def: DefinicaoExercicio): ExercicioMetodo {
  return { nome: def.nome, sustentacao: ehSustentacao(def), segPorRep: def.seg_por_rep ?? 3, lateral: def.camera === "lateral" };
}

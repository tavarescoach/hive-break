/**
 * Avisos de posicionamento: o que a câmera não está vendo e como corrigir,
 * sempre com o celular em pé (decisão do Luan: nunca pedir para girar o celular).
 */
import { distancia, pontoMedio } from "./geometria";
import { INDICE_PONTO, indicesDoPonto } from "./pontos";
import type { DefinicaoExercicio, Ponto } from "./tipos";

export interface Enquadramento {
  /** Os pontos obrigatórios estão visíveis: a câmera consegue avaliar. */
  ok: boolean;
  /** Frase curta para corrigir, ou null quando está tudo certo. */
  aviso: string | null;
}

type Regiao = "cabeca" | "bracos" | "tronco" | "joelhos" | "pes";

const REGIAO_DO_PONTO: Record<string, Regiao> = {
  nariz: "cabeca", olho: "cabeca", orelha: "cabeca", boca: "cabeca",
  ombro: "tronco", quadril: "tronco",
  cotovelo: "bracos", punho: "bracos", mindinho: "bracos", indicador: "bracos", polegar: "bracos",
  joelho: "joelhos",
  tornozelo: "pes", calcanhar: "pes", ponta_pe: "pes",
};

const AVISOS: Record<Regiao, string> = {
  cabeca: "Não vejo sua cabeça: afaste-se um pouco ou incline o celular para cima.",
  bracos: "Não vejo seus braços: deixe as mãos dentro da imagem.",
  tronco: "Não vejo seu tronco: fique no meio da imagem.",
  joelhos: "Não vejo seus joelhos: afaste-se um pouco ou incline o celular para baixo.",
  pes: "Não vejo seus pés: afaste-se um pouco ou incline o celular para baixo.",
};

const regiaoDe = (nome: string): Regiao => REGIAO_DO_PONTO[nome.replace(/_(e|d)$/, "")] ?? "tronco";

/**
 * Diz se a câmera consegue avaliar o exercício e, se não, o que corrigir.
 * Também avisa quando a pessoa está de frente num exercício de lado (ou o contrário).
 */
export function avaliarEnquadramento(pontos: Ponto[] | null, def: DefinicaoExercicio, visibilidadeMinima: number, proporcao = 1): Enquadramento {
  if (!pontos || pontos.length < 33) return { ok: false, aviso: "Não estou te vendo: fique na frente da câmera." };
  const visivel = (i: number) => (pontos[i].visibility ?? 1) >= visibilidadeMinima;

  // Pontos obrigatórios que faltam, agrupados pela região do corpo (de cima para baixo).
  const faltando = def.pontos_obrigatorios.filter((nome) => !indicesDoPonto(nome).some(visivel));
  if (faltando.length > 0) {
    const ordem: Regiao[] = ["tronco", "cabeca", "bracos", "joelhos", "pes"];
    const regioes = new Set(faltando.map(regiaoDe));
    const regiao = ordem.find((r) => regioes.has(r))!;
    return { ok: false, aviso: AVISOS[regiao] };
  }

  // Meio corpo (sentado, celular no monitor): o quadril pode estar escondido pela mesa.
  // Sem quadril visível, não dá para conferir de frente/de lado pela proporção do tronco.
  const quadrilVisivel = visivel(INDICE_PONTO.quadril_e) || visivel(INDICE_PONTO.quadril_d);
  if (def.enquadramento === "meio_corpo" && !quadrilVisivel) return { ok: true, aviso: null };

  // De frente ou de lado: largura dos ombros em relação ao tronco.
  const p = (nome: string) => ({ x: pontos[INDICE_PONTO[nome]].x * proporcao, y: pontos[INDICE_PONTO[nome]].y, z: 0 });
  const ombros = distancia(p("ombro_e"), p("ombro_d"));
  const tronco = distancia(pontoMedio(p("ombro_e"), p("ombro_d")), pontoMedio(p("quadril_e"), p("quadril_d")));
  const deitado = Math.abs(pontos[INDICE_PONTO.ombro_e].y - pontos[INDICE_PONTO.quadril_e].y) < 0.08;
  if (tronco > 0.05 && !deitado) {
    const razao = ombros / tronco;
    if (def.camera === "lateral" && razao > 0.55) return { ok: true, aviso: "Vire de lado para o celular." };
    if (def.camera === "frontal" && razao < 0.25) return { ok: true, aviso: "Fique de frente para o celular." };
  }
  return { ok: true, aviso: null };
}

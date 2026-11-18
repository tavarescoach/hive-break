/**
 * Guarda a tela final no sessionStorage da aba para ela sobreviver a um
 * recarregamento. No iPhone, ao ir para o Instagram e voltar, o Safari às vezes
 * descarta a aba e recarrega a página: sem isto, o resultado e o card sumiam.
 *
 * Fica só neste aparelho e nesta aba (some quando a aba fecha). Nada vai para o
 * servidor. Toda leitura e escrita é protegida: sem storage, a tela funciona igual.
 */

import type { Formato, Toggles } from "./desenhar-card";

/** Depois disso, abrir o desafio de novo mostra a tela inicial, não o resultado antigo. */
const VALIDADE_MS = 2 * 60 * 60 * 1000;

export type OrigemFundo = "hive" | "selfie" | "galeria";

export interface EstadoCardSalvo {
  aberto: boolean;
  formato: Formato;
  origem: OrigemFundo;
  toggles: Toggles;
  /** Foto de fundo reduzida, em JPEG (data URL). */
  foto?: string | null;
}

export interface FimSalvo<R = unknown, E = unknown, Rec = unknown> {
  salvoEm: number;
  resultado: R;
  envio: E;
  /** Recordes de antes deste treino (depois de recarregar, o servidor já conta o de hoje). */
  recordes: Rec;
  /** ISO da hora em que o treino terminou. */
  quando: string;
  pse?: number | null;
  card?: EstadoCardSalvo;
}

const chave = (id: string) => `hb:fim:${id}`;

export function lerFim<R, E, Rec>(id: string): FimSalvo<R, E, Rec> | null {
  try {
    const texto = sessionStorage.getItem(chave(id));
    if (!texto) return null;
    const salvo = JSON.parse(texto) as FimSalvo<R, E, Rec>;
    if (!salvo.salvoEm || Date.now() - salvo.salvoEm > VALIDADE_MS) {
      sessionStorage.removeItem(chave(id));
      return null;
    }
    return salvo;
  } catch {
    return null;
  }
}

export function salvarFim(id: string, dados: Omit<FimSalvo, "salvoEm">): void {
  gravar(id, { ...dados, salvoEm: Date.now() });
}

/** Atualiza parte do que já está salvo (PSE, opções do card). */
export function atualizarFim(id: string, parcial: Partial<Omit<FimSalvo, "salvoEm" | "card">> & { card?: Partial<EstadoCardSalvo> }): void {
  const atual = lerFim(id);
  if (!atual) return;
  const card = parcial.card ? ({ ...atual.card, ...parcial.card } as EstadoCardSalvo) : atual.card;
  gravar(id, { ...atual, ...parcial, card });
}

export function apagarFim(id: string): void {
  try {
    sessionStorage.removeItem(chave(id));
  } catch {
    // sem storage: nada a apagar
  }
}

function gravar(id: string, valor: FimSalvo): void {
  try {
    sessionStorage.setItem(chave(id), JSON.stringify(valor));
  } catch {
    // Cota cheia (foto grande): tenta de novo sem a foto.
    try {
      if (valor.card?.foto) sessionStorage.setItem(chave(id), JSON.stringify({ ...valor, card: { ...valor.card, foto: null } }));
    } catch {
      // sem storage: a tela continua funcionando, só não sobrevive a um recarregamento
    }
  }
}

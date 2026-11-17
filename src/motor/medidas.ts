import { angulo, distancia, pontoMedio, type Vetor } from "./geometria";
import { PLURAIS, resolverPonto } from "./pontos";
import type { CombinarLados, DefinicaoMedida, Lado, Ponto } from "./tipos";

/** Pose já preparada para medir: imagem com x corrigido pela proporção, e mundo em metros. */
export interface PoseMedida {
  imagem: Vetor[];
  mundo: Vetor[] | null;
  visibilidade: number[];
}

export function prepararPose(pontos: Ponto[], mundo: Ponto[] | null | undefined, proporcao: number): PoseMedida {
  return {
    // Em imagem só usamos x e y; x é multiplicado pela proporção para que as
    // distâncias valham o mesmo na horizontal e na vertical.
    imagem: pontos.map((p) => ({ x: p.x * proporcao, y: p.y, z: 0 })),
    mundo: mundo ? mundo.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })) : null,
    visibilidade: pontos.map((p) => p.visibility ?? 1),
  };
}

function ponto(lista: Vetor[], nome: string, lado: Lado | null): Vetor {
  const ref = resolverPonto(nome);
  if (ref.tipo === "unico") return lista[ref.indice];
  if (lado === "e") return lista[ref.e];
  if (lado === "d") return lista[ref.d];
  return pontoMedio(lista[ref.e], lista[ref.d]);
}

function razao(valor: number, lista: Vetor[], ref: [string, string] | undefined, lado: Lado | null): number {
  if (!ref) return valor;
  const d = distancia(ponto(lista, ref[0], lado), ponto(lista, ref[1], lado));
  return d < 1e-6 ? NaN : valor / d;
}

function medirLado(def: DefinicaoMedida, pose: PoseMedida, lado: Lado | null): number {
  // "movimento" depende do frame anterior e é calculada pelo motor.
  if (def.tipo === "movimento") return NaN;
  if (def.tipo === "inclinacao") {
    const a = ponto(pose.imagem, def.pontos[0], lado);
    const b = ponto(pose.imagem, def.pontos[1], lado);
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx + dy < 1e-9) return NaN;
    return (Math.atan2(dx, dy) * 180) / Math.PI;
  }
  if (def.tipo === "angulo") {
    const lista = (def.espaco ?? "3d") === "3d" ? pose.mundo : pose.imagem;
    if (!lista) return NaN;
    return angulo(ponto(lista, def.pontos[0], lado), ponto(lista, def.pontos[1], lado), ponto(lista, def.pontos[2], lado));
  }
  const lista = pose.imagem;
  const a = ponto(lista, def.pontos[0], lado);
  const b = ponto(lista, def.pontos[1], lado);
  if (def.tipo === "distancia") return razao(distancia(a, b), lista, def.normalizar_por, lado);
  // altura: y cresce para baixo na imagem, então a.y - b.y é positivo quando b está acima de a.
  return razao(a.y - b.y, lista, def.normalizar_por, lado);
}

export function calcularMedida(def: DefinicaoMedida, pose: PoseMedida): number {
  const combinar: CombinarLados | undefined = def.lado ?? (def.tipo === "angulo" ? "media" : undefined);
  if (!combinar) return medirLado(def, pose, null);
  if (combinar === "e" || combinar === "d") return medirLado(def, pose, combinar);
  if (combinar === "visivel") return medirLado(def, pose, ladoMaisVisivel(def.pontos, pose));
  const e = medirLado(def, pose, "e");
  const d = medirLado(def, pose, "d");
  if (Number.isNaN(e) || Number.isNaN(d)) return NaN;
  if (combinar === "min") return Math.min(e, d);
  if (combinar === "max") return Math.max(e, d);
  return (e + d) / 2;
}

/** Lado que a câmera enxerga melhor, pela visibilidade média dos pontos da medida. */
export function ladoMaisVisivel(nomes: string[], pose: PoseMedida): Lado {
  let e = 0;
  let d = 0;
  for (const nome of nomes) {
    const ref = resolverPonto(nome);
    if (ref.tipo !== "par") continue;
    e += pose.visibilidade[ref.e];
    d += pose.visibilidade[ref.d];
  }
  return e >= d ? "e" : "d";
}

/** `dist(joelhos)` ou `dist(punho_e, ombro_e)`: distância na imagem. */
export function distEntre(pontos: string[], pose: PoseMedida): number {
  if (pontos.length === 1) {
    const base = PLURAIS[pontos[0]] ?? pontos[0];
    const ref = resolverPonto(base);
    if (ref.tipo !== "par") throw new Error(`dist(${pontos[0]}) precisa de um ponto com lado esquerdo e direito`);
    return distancia(pose.imagem[ref.e], pose.imagem[ref.d]);
  }
  return distancia(ponto(pose.imagem, pontos[0], null), ponto(pose.imagem, pontos[1], null));
}

/** Valida os nomes de ponto de uma medida (lança erro se algum não existir). */
export function validarMedida(def: DefinicaoMedida): void {
  for (const nome of def.pontos) resolverPonto(nome);
  if ("normalizar_por" in def && def.normalizar_por) for (const nome of def.normalizar_por) resolverPonto(nome);
}

export function validarDist(pontos: string[]): void {
  if (pontos.length === 1) {
    const ref = resolverPonto(PLURAIS[pontos[0]] ?? pontos[0]);
    if (ref.tipo !== "par") throw new Error(`dist(${pontos[0]}) precisa de um ponto com lado esquerdo e direito`);
  } else {
    for (const nome of pontos) resolverPonto(nome);
  }
}

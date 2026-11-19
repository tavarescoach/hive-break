/**
 * Modo TV: espelhar o iPhone numa TV presa na parede em pé (retrato).
 *
 * A TV recebe uma imagem horizontal (16:9) e a mostra deitada. Para ocupar a TV inteira, o
 * celular fica na horizontal e o app se desenha girado (90° ou 270°), como se ainda estivesse
 * em pé. Com o celular em pé, nada gira.
 *
 * Ligar: abrir qualquer tela com `?girar=270` (ou `?girar=90`). Fica salvo no aparelho
 * (localStorage e cookie "modoTV") e vale em todas as telas. Desligar: `?girar=0`.
 * O cookie é gravado também pelo servidor (src/proxy.ts), porque redirecionamentos como
 * "/" → "/trilha" perdem o `?girar` antes de o script da página rodar.
 *
 * App na tela de início: o <link rel="manifest"> é criado por este script; com o modo TV
 * ligado, aponta para /manifest-tv.webmanifest, cujo start_url já traz o ?girar. O app salvo tem armazenamento
 * próprio, separado do Safari, então é o start_url que liga o modo TV nele.
 *
 * Quem gira é o CSS (globals.css), pela classe `modo-tv` no <html> e o atributo
 * `data-tv-giro`, dentro de `@media (orientation: landscape)`. Assim a rotação acompanha a
 * orientação na hora, sem depender do React nem de estilo inline.
 */

export const CHAVE_MODO_TV = "modoTV";

/**
 * Lê `?girar` da URL, salva (ou apaga) a escolha e marca o <html>.
 * Precisa ser autocontida: também roda serializada num <script> antes da página aparecer.
 */
export function aplicarModoTV(): void {
  const raiz = document.documentElement;
  const chave = "modoTV";
  let giro: string | null = null;
  // A URL manda; sem ela, vale o cookie que o servidor gravou (sobrevive a redirecionamentos).
  const daUrl = new URLSearchParams(window.location.search).get("girar");
  const doCookie = /(?:^|;\s*)modoTV=(0|90|270)(?:;|$)/.exec(document.cookie)?.[1] ?? null;
  const pedido = daUrl === "0" || daUrl === "90" || daUrl === "270" ? daUrl : doCookie;
  try {
    if (pedido === "90" || pedido === "270") window.localStorage.setItem(chave, pedido);
    else if (pedido === "0") window.localStorage.removeItem(chave);
    giro = window.localStorage.getItem(chave);
  } catch {
    // Sem localStorage (bloqueado): vale ao menos o que veio na URL, ou o que já estava marcado.
    giro = pedido === "0" ? null : pedido === "90" || pedido === "270" ? pedido : raiz.dataset.tvGiro ?? null;
  }
  const ligado = giro === "90" || giro === "270";
  // Cookie e localStorage sempre com a mesma escolha (sem cookie novo para quem nunca usou).
  if (ligado || doCookie !== null) document.cookie = `modoTV=${ligado ? giro : "0"}; path=/; max-age=31536000; samesite=lax`;
  if (ligado) {
    raiz.classList.add("modo-tv");
    raiz.dataset.tvGiro = giro!;
  } else {
    raiz.classList.remove("modo-tv");
    delete raiz.dataset.tvGiro;
  }
  // "Adicionar à Tela de Início" com o modo TV ligado salva o app já girado (manifesto do modo TV).
  // O link é criado aqui, no <head>, já com o endereço certo: o iPhone pode ler o manifesto assim
  // que o link aparece, então ele nunca deve existir apontando para o manifesto errado.
  const manifesto = ligado ? `/manifest-tv.webmanifest?girar=${giro}` : "/manifest.webmanifest";
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]');
  if (links.length === 0) {
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = manifesto;
    document.head.appendChild(link);
  }
  links.forEach((link) => {
    if (link.getAttribute("href") !== manifesto) link.setAttribute("href", manifesto);
  });
}

/** Script que roda no <head>, antes da primeira pintura, para não piscar a tela deitada. */
export const SCRIPT_MODO_TV = `(${aplicarModoTV.toString()})()`;

/** Modo TV ligado e celular na horizontal: o app está desenhado girado. */
export function estaGirado(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("modo-tv") && window.matchMedia("(orientation: landscape)").matches;
}

/** Altura útil da tela, do ponto de vista do app (girado, é a largura física). */
export function alturaVisivel(): number {
  return estaGirado() ? window.innerWidth : window.innerHeight;
}

/** Distância do topo do elemento ao topo da tela, do ponto de vista do app. */
export function topoVisivel(el: Element): number {
  const r = el.getBoundingClientRect();
  if (!estaGirado()) return r.top;
  // 270°: o topo do app fica à esquerda da tela física. 90°: fica à direita.
  return document.documentElement.dataset.tvGiro === "90" ? window.innerWidth - r.right : r.left;
}

/** Volta a rolagem ao topo, seja a da janela, seja a do container do modo TV. */
export function rolarParaOTopo(): void {
  window.scrollTo(0, 0);
  document.getElementById("raiz")?.scrollTo(0, 0);
}

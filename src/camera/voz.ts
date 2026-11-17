/**
 * Frases de voz do treinador (Web Speech API), no máximo uma a cada 4 segundos
 * (seção 8.1). Sem suporte no aparelho, simplesmente não fala.
 */
let ultimaFala = 0;

export function falar(texto: string, forcar = false): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const agora = performance.now();
    if (!forcar && agora - ultimaFala < 4000) return;
    ultimaFala = agora;
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 1.05;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(fala);
  } catch {
    // Voz indisponível: o aviso continua aparecendo na tela.
  }
}

export function calarVoz(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Nada a fazer.
  }
}

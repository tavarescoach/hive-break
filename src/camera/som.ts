/**
 * Sons curtos de confirmação (Web Audio). O contexto precisa ser criado dentro
 * de um toque do usuário, por isso `prepararSom` é chamado no botão "Começar".
 */
let contexto: AudioContext | null = null;

export function prepararSom(): void {
  try {
    const Classe = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Classe) return;
    contexto ??= new Classe();
    if (contexto.state === "suspended") void contexto.resume();
  } catch {
    contexto = null;
  }
}

function bipe(frequencia: number, duracaoS: number, atrasoS = 0, volume = 0.25, tipo: OscillatorType = "sine"): void {
  if (!contexto) return;
  const inicio = contexto.currentTime + atrasoS;
  const oscilador = contexto.createOscillator();
  const ganho = contexto.createGain();
  oscilador.type = tipo;
  oscilador.frequency.value = frequencia;
  ganho.gain.setValueAtTime(0.0001, inicio);
  ganho.gain.exponentialRampToValueAtTime(volume, inicio + 0.01);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracaoS);
  oscilador.connect(ganho).connect(contexto.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracaoS + 0.02);
}

function vibrar(padrao: number | number[]): void {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    // Sem vibração neste aparelho (ex.: iPhone).
  }
}

export const som = {
  /** Repetição válida. */
  valida() {
    bipe(880, 0.12);
    vibrar(40);
  },
  /** Repetição parcial ou posição perdida: som mais grave. */
  parcial() {
    bipe(260, 0.2, 0, 0.22, "triangle");
    vibrar([30, 40, 30]);
  },
  /** Contagem regressiva. */
  tique() {
    bipe(520, 0.08, 0, 0.15);
  },
  /** Valendo! */
  largada() {
    bipe(1040, 0.3, 0, 0.3);
    vibrar(120);
  },
  /** Meta batida. */
  fim() {
    bipe(660, 0.14);
    bipe(880, 0.14, 0.14);
    bipe(1320, 0.3, 0.28);
    vibrar([80, 60, 160]);
  },
};

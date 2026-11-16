/**
 * Abre a câmera. Só a frontal (facingMode "user"), sem áudio, 640x480 a 30 fps.
 * O vídeo fica apenas no elemento <video> da página: nunca é gravado nem enviado.
 */
export async function abrirCameraFrontal(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador não dá acesso à câmera. Use o Chrome no Android ou o Safari no iPhone.");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "user" },
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
      },
    });
  } catch (erro) {
    const nome = (erro as DOMException).name;
    if (nome === "NotAllowedError" || nome === "SecurityError") {
      throw new Error("A câmera foi bloqueada. Libere a permissão de câmera para este site nas configurações do navegador e tente de novo.");
    }
    if (nome === "NotFoundError" || nome === "OverconstrainedError") {
      throw new Error("Não encontrei uma câmera frontal neste aparelho.");
    }
    if (nome === "NotReadableError") {
      throw new Error("A câmera está sendo usada por outro aplicativo. Feche-o e tente de novo.");
    }
    throw new Error("Não consegui abrir a câmera. Tente recarregar a página.");
  }
}

export function fecharCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((faixa) => faixa.stop());
}

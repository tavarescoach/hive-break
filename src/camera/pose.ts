import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export type ModeloPose = "lite" | "full";
export type Delegado = "GPU" | "CPU";

// WASM e modelos são servidos do nosso domínio (ver scripts/preparar-mediapipe.mjs).
// Não há reserva em servidor externo: a política de segurança do site só permite
// conexões com o próprio domínio.
const WASM = "/mediapipe/wasm";
const MODELOS: Record<ModeloPose, string> = {
  lite: "/mediapipe/modelos/pose_landmarker_lite.task",
  full: "/mediapipe/modelos/pose_landmarker_full.task",
};

export interface Detector {
  landmarker: PoseLandmarker;
  delegado: Delegado;
  modelo: ModeloPose;
}

/**
 * Carrega o Pose Landmarker. Tudo roda no aparelho: as únicas requisições de
 * rede são para baixar o WASM e o modelo do nosso domínio. Nenhuma imagem é enviada.
 * Tenta GPU (WebGL) e cai para CPU se o aparelho não suportar.
 */
export async function criarDetector(modelo: ModeloPose): Promise<Detector> {
  const caminhoModelo = MODELOS[modelo];
  const disponivel = await fetch(caminhoModelo, { method: "HEAD" }).then(
    (r) => r.ok,
    () => false,
  );
  if (!disponivel) throw new Error("Não consegui baixar o detector de movimento. Confira a internet e tente de novo.");
  const fileset = await FilesetResolver.forVisionTasks(WASM);

  const criar = (delegado: Delegado) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: caminhoModelo, delegate: delegado },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

  let landmarker: PoseLandmarker;
  let delegado: Delegado = "GPU";
  try {
    landmarker = await criar("GPU");
  } catch {
    delegado = "CPU";
    landmarker = await criar("CPU");
  }
  return { landmarker, delegado, modelo };
}

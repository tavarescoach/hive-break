// Copia o WASM do MediaPipe de node_modules e baixa os modelos de pose para
// public/mediapipe, para que tudo seja servido do nosso próprio domínio.
// No postinstall uma falha só gera aviso; no build (--obrigatorio) ela derruba
// o build, porque o app não tem reserva em servidor externo.
import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "public", "mediapipe");
const origemWasm = path.join(raiz, "node_modules", "@mediapipe", "tasks-vision", "wasm");

const BASE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";
const MODELOS = {
  "pose_landmarker_lite.task": `${BASE}/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`,
  "pose_landmarker_full.task": `${BASE}/pose_landmarker_full/float16/latest/pose_landmarker_full.task`,
};

async function copiarWasm() {
  if (!existsSync(origemWasm)) {
    console.warn("[mediapipe] pacote @mediapipe/tasks-vision ainda não instalado; pulei o WASM.");
    faltou = true;
    return;
  }
  await mkdir(path.join(destino, "wasm"), { recursive: true });
  await cp(origemWasm, path.join(destino, "wasm"), { recursive: true });
  console.log("[mediapipe] WASM copiado para public/mediapipe/wasm");
}

async function baixarModelos() {
  const pasta = path.join(destino, "modelos");
  await mkdir(pasta, { recursive: true });
  for (const [nome, url] of Object.entries(MODELOS)) {
    const arquivo = path.join(pasta, nome);
    if (existsSync(arquivo) && (await stat(arquivo)).size > 1_000_000) continue;
    try {
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const dados = Buffer.from(await resposta.arrayBuffer());
      await writeFile(arquivo, dados);
      console.log(`[mediapipe] ${nome} baixado (${(dados.length / 1e6).toFixed(1)} MB)`);
    } catch (erro) {
      console.warn(`[mediapipe] não consegui baixar ${nome}: ${erro.message}`);
      faltou = true;
    }
  }
}

const obrigatorio = process.argv.includes("--obrigatorio");
let faltou = false;
try {
  await copiarWasm();
  await baixarModelos();
} catch (erro) {
  console.warn("[mediapipe] preparação incompleta:", erro.message);
  faltou = true;
}
if (!existsSync(path.join(destino, "wasm", "vision_wasm_internal.wasm"))) faltou = true;
if (faltou && obrigatorio) {
  console.error("[mediapipe] WASM ou modelos ausentes em public/mediapipe. O build foi interrompido.");
  process.exit(1);
}

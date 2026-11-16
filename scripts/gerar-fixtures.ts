// Gera as fixtures sintéticas em /fixtures a partir dos roteiros de
// src/motor/__tests__/sintetico.ts. Rode com: npm run fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fixtureDoRoteiro, ROTEIROS } from "../src/motor/__tests__/sintetico";

const pasta = path.resolve(__dirname, "..", "fixtures", "sinteticas");
mkdirSync(pasta, { recursive: true });

for (const nome of Object.keys(ROTEIROS)) {
  const { frames, ...cabecalho } = fixtureDoRoteiro(nome);
  // Um frame por linha: o arquivo fica legível e os diffs, pequenos.
  const corpo = frames.map((f) => "    " + JSON.stringify(f)).join(",\n");
  const texto = JSON.stringify(cabecalho, null, 2).replace(/\n}$/, `,\n  "frames": [\n${corpo}\n  ]\n}\n`);
  JSON.parse(texto);
  writeFileSync(path.join(pasta, `${nome}.json`), texto);
  console.log(`${nome}.json: ${frames.length} frames, ${(texto.length / 1024).toFixed(0)} KB`);
}

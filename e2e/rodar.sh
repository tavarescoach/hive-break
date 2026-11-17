#!/usr/bin/env bash
# Sobe o Supabase falso e o app, roda o fluxo da Fase 1 e derruba tudo.
# Uso: bash e2e/rodar.sh   (variáveis opcionais: CAPTURAS, CAMERA_FALSA)
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=chave-publica-de-teste
LOGS="${LOGS:-$(mktemp -d)}"

# Derruba também os processos filhos do npx, pelas portas.
encerrar() {
  kill "${FALSO:-}" "${APP_PID:-}" 2>/dev/null || true
  for porta in 54329 3111; do
    (command -v fuser >/dev/null && fuser -k "$porta/tcp" >/dev/null 2>&1) || true
  done
}
trap encerrar EXIT
encerrar
sleep 1

npx tsx e2e/supabase-falso.ts >"$LOGS/supabase-falso.log" 2>&1 &
FALSO=$!
npm run build >"$LOGS/build.log" 2>&1 || { tail -30 "$LOGS/build.log"; exit 1; }
npx next start -p 3111 >"$LOGS/app.log" 2>&1 &
APP_PID=$!
for _ in $(seq 1 40); do
  curl -sf -o /dev/null http://localhost:3111/teste-tecnico && curl -sf -o /dev/null -X POST http://localhost:54329/__controle/pronto && break
  sleep 0.5
done
node e2e/fluxo-fase1.mjs || { echo "--- supabase falso"; tail -15 "$LOGS/supabase-falso.log"; echo "--- app"; tail -15 "$LOGS/app.log"; exit 1; }

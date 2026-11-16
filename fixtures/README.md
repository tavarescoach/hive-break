# Fixtures de landmarks

Sequências de pontos do corpo usadas nos testes do motor de detecção.

- `sinteticas/`: geradas por `npm run fixtures` a partir de um boneco 3D
  (ver `src/motor/__tests__/sintetico.ts`). Não edite à mão.
- `reais/`: gravações feitas na página `/teste-tecnico` (botão "Gravar"), por
  testadores que consentiram. Cada arquivo precisa do campo `esperado` com a
  contagem manual. O teste `fixtures-reais.test.ts` roda todos os arquivos
  desta pasta e falha se o motor errar mais que 1 em 10.

Formato: `{ versao, exercicio, origem, proporcao, esperado, frames: [{ t, p, m }] }`,
com `t` em ms, `p` = `[x, y, visibilidade]` na imagem (33 pontos) e
`m` = `[x, y, z]` em metros (33 pontos). Não há imagem nem vídeo nesses arquivos.

Exemplo de `esperado` numa gravação real:

```json
"esperado": { "reps_validas": 12 }
```

ou, para o apoio em uma perna, `"esperado": { "tempo_valido_s": 30 }`.

# Hive Break

Jogo de atividade física no navegador, estilo Duolingo, com validação de movimento pela
câmera frontal do celular. Especificação em [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md)
e decisões em [`docs/DECISOES.md`](docs/DECISOES.md).

**Estado atual: Fase 0 (teste técnico).** Página `/teste-tecnico` com câmera frontal,
esqueleto e contagem de agachamento livre, polichinelo e apoio em uma perna.

## Rodar

```bash
npm install
```

```bash
npm run dev
```

A câmera só funciona em HTTPS ou em `localhost`. Para testar no celular, use a URL de
preview da Vercel.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (baixa os modelos de pose se faltarem) |
| `npm test` | Testes unitários do motor (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos |
| `npm run fixtures` | Regera as fixtures sintéticas em `fixtures/sinteticas` |

## Estrutura

- `src/motor/`: motor genérico de análise de movimento (TypeScript puro, sem DOM).
- `src/exercicios/`: definições dos exercícios em JSON, lidas pelo motor.
- `src/camera/`: câmera frontal, MediaPipe Pose Landmarker, esqueleto e sons.
- `src/app/teste-tecnico/`: página do teste técnico.
- `fixtures/`: sequências de landmarks usadas nos testes (ver `fixtures/README.md`).

## Privacidade

A imagem da câmera é processada no aparelho e nunca é gravada nem enviada. O site usa
`Content-Security-Policy: connect-src 'self'`, então o próprio navegador recusa
conexões para fora do domínio.

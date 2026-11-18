# Hive Break

Jogo de atividade física no navegador, estilo Duolingo, com validação de movimento pela
câmera frontal do celular. Especificação em [`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md)
e decisões em [`docs/DECISOES.md`](docs/DECISOES.md).

**Estado atual:** visitante joga antes do cadastro (username + código de 6 dígitos por
e-mail, Google como alternativa, ver [`docs/VISITANTE.md`](docs/VISITANTE.md)), banco com RLS, primeiro acesso, perfil, convite, trilha
em seções e unidades e desafios validados pela câmera (19 exercícios; 3 calibrados com
pessoas). O teste técnico da câmera continua em `/teste-tecnico`. Orientação de produto em
[`docs/REFERENCIAS_PRODUTO.md`](docs/REFERENCIAS_PRODUTO.md).

Para ligar o Supabase, o Google e a Vercel, siga [`docs/CONFIGURACAO.md`](docs/CONFIGURACAO.md).

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
| `npm test` | Testes unitários: motor, regras do perfil e RLS do banco (Vitest) |
| `npm run e2e` | Fluxo completo no navegador contra um Supabase falso (ver `e2e/README.md`) |
| `npm run sql` | Regera `supabase/instalar.sql` a partir das migrações |
| `npm run seed:trilha` | Regera `supabase/seed_trilha.sql` (exercícios, unidades e desafios) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos |
| `npm run fixtures` | Regera as fixtures sintéticas em `fixtures/sinteticas` |

## Estrutura

- `src/motor/`: motor genérico de análise de movimento (TypeScript puro, sem DOM).
- `src/exercicios/`: definições dos exercícios em JSON, lidas pelo motor.
- `src/camera/`: câmera frontal, MediaPipe Pose Landmarker, esqueleto e sons.
- `src/app/teste-tecnico/`: página do teste técnico.
- `src/dominio/`: regras do perfil, da triagem e da ordem do primeiro acesso.
- `src/app/`: telas (landing, login, onboarding, trilha, liga, amigos, perfil).
- `supabase/`: migrações SQL (30 tabelas, RLS, funções) e seed.
- `src/banco/`: banco de teste embutido e testes de RLS.
- `e2e/`: teste de ponta a ponta e servidor Supabase falso (só para teste).
- `fixtures/`: sequências de landmarks usadas nos testes (ver `fixtures/README.md`).

## Privacidade

A imagem da câmera é processada no aparelho e nunca é gravada nem enviada. O site usa
`Content-Security-Policy: connect-src 'self'`, então o próprio navegador recusa
conexões para fora do domínio, com exceção do projeto Supabase, que recebe só dados
numéricos e de cadastro. Dados de saúde são protegidos por RLS: só o dono lê.

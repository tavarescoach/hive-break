# Testes de ponta a ponta

Rodam o app de verdade no Chromium contra um **servidor Supabase falso**
(`supabase-falso.ts`), que usa um Postgres embutido com as migrações reais.
Não precisam de projeto Supabase nem de conta Google. Servem só para teste:
nada daqui vai para produção.

Precisam do Playwright com Chromium instalado na máquina.

```bash
npx tsx e2e/supabase-falso.ts
```

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=teste npm run build
```

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54329 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=teste npx next start -p 3111
```

```bash
node e2e/fluxo-fase1.mjs
```

O servidor falso começa com o banco vazio a cada execução; reinicie-o antes de
repetir o teste.

# Configuração: Supabase, Google e Vercel

Passo a passo para ligar o login e o banco (Fase 1). Leva uns 20 minutos.
Nenhuma chave secreta entra no repositório.

## 1. Banco no Supabase

1. Crie um projeto em supabase.com (região São Paulo).
2. Abra **SQL Editor**, cole o conteúdo inteiro de [`supabase/instalar.sql`](../supabase/instalar.sql)
   e clique em **Run**. Isso cria as tabelas, a RLS, as funções e o conteúdo inicial
   (8 níveis, 24 unidades, desafios e conquistas). Esse arquivo só roda uma vez, num projeto novo.
3. Confira em **Table Editor** que a tabela `levels` tem 8 linhas.

### Se o banco já foi instalado antes da trilha em unidades (17/11/2026)

Quem rodou o `instalar.sql` antigo precisa colar mais dois arquivos no SQL Editor, nesta
ordem:

1. [`supabase/migrations/20261117000600_trilha_unidades.sql`](../supabase/migrations/20261117000600_trilha_unidades.sql)
2. [`supabase/seed_trilha.sql`](../supabase/seed_trilha.sql) (exercícios, unidades e desafios; pode ser rodado de novo sempre que o conteúdo mudar)

### Desafios com câmera (17/11/2026)

Quem já tinha a trilha em unidades precisa colar mais dois arquivos, nesta ordem:

1. [`supabase/migrations/20261117000700_finalizar_desafio.sql`](../supabase/migrations/20261117000700_finalizar_desafio.sql) (obrigatório: sem ele o botão "Concluí" avisa que o banco não foi atualizado)
2. [`supabase/seed_trilha.sql`](../supabase/seed_trilha.sql) de novo (atualiza as regras dos 19 exercícios guardadas no banco)

Quem ainda não instalou nada usa só o `instalar.sql`, que já inclui tudo.

Nas próximas fases eu aviso quais arquivos novos de `supabase/migrations/` precisam ser
colados no SQL Editor, na ordem do nome.

## 2. Login com Google

1. No Google Cloud Console, crie um projeto e, em **APIs e serviços > Tela de consentimento
   OAuth**, configure o app (tipo Externo, nome "Hive Break", seu e-mail).
2. Em **Credenciais > Criar credenciais > ID do cliente OAuth**, escolha "Aplicativo da Web".
   Em **URIs de redirecionamento autorizados**, coloque o endereço que o Supabase mostra em
   **Authentication > Sign In / Providers > Google** (termina em `/auth/v1/callback`).
3. Copie o **ID do cliente** e a **chave secreta** para essa mesma tela do Supabase e ative
   o provedor Google.
4. Enquanto a tela de consentimento estiver em modo "Teste", só entram os e-mails que você
   listar como usuários de teste. Para o grupo fechado, publique o app no Google
   (para os dados básicos de nome, e-mail e foto não há revisão demorada).

## 3. Endereços permitidos no Supabase

Em **Authentication > URL Configuration**:

- **Site URL**: o endereço de produção na Vercel (ex.: `https://hive-break.vercel.app`).
- **Redirect URLs**: adicione `https://hive-break.vercel.app/auth/callback` e, para as
  URLs de preview, `https://*-SEU-TIME.vercel.app/auth/callback` (troque pelo sufixo que
  aparece nas suas URLs de preview).

Se o login voltar para o endereço errado, é esta lista que está incompleta.

## 4. Variáveis na Vercel

Em **Settings > Environment Variables**, para Production e Preview:

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Supabase > Project Settings > API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave "publishable" (ou a antiga "anon") |

Depois, faça um **Redeploy**: as variáveis entram no build, e a política de segurança do
site só libera conexões com o domínio do Supabase informado ali.

Não use a chave `service_role` em nenhuma variável `NEXT_PUBLIC_`.

## 5. Conferir

1. Abra o site: a landing aparece. Sem as variáveis, aparece "Falta ligar o banco de dados".
2. Toque em **Começar**, entre com Google e siga o cadastro até a trilha.
3. No Supabase, a tabela `profiles` deve ter a sua linha, com `onboarding_concluido_em`
   preenchido.

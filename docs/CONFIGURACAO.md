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

### Métodos dos desafios (18/11/2026)

Rode, nesta ordem:

1. [`supabase/migrations/20261118000800_metodos.sql`](../supabase/migrations/20261118000800_metodos.sql) (adiciona a coluna `metodo`)
2. [`supabase/seed_trilha.sql`](../supabase/seed_trilha.sql) de novo (grava o método, a duração e os exercícios de cada desafio)

Sem os dois, os desafios continuam funcionando no formato antigo (um tempo por exercício).

### Desafios em blocos (18/11/2026)

Rode, nesta ordem:

1. [`supabase/migrations/20261118000900_blocos.sql`](../supabase/migrations/20261118000900_blocos.sql) (blocos, contagem do "Prepare-se" e PSE)
2. [`supabase/seed_trilha.sql`](../supabase/seed_trilha.sql) de novo

Sem os dois, o app converte o formato anterior na hora e continua funcionando; a PSE e a
escolha da contagem só funcionam depois da migração.

### Hive ao vivo (19/11/2026)

Rode [`supabase/migrations/20261119001000_hive.sql`](../supabase/migrations/20261119001000_hive.sql)
no SQL Editor. Ela cria as tabelas `hives` e `hive_participantes`, as funções da hive e
atualiza `finalizar_desafio` (quem está numa hive pode fazer o desafio mesmo bloqueado na
trilha). O tempo real usa o Realtime do Supabase, que já vem ligado: nada a configurar.
Sem a migração, a aba Hive avisa que falta rodá-la e o resto do app segue igual.

### Avaliação menos exigente (18/11/2026)

Nada obrigatório: o app usa as regras dos exercícios direto do código. Rodar de novo o
[`supabase/seed_trilha.sql`](../supabase/seed_trilha.sql) só atualiza a cópia das regras
guardada no banco.

### Liga semanal (17/11/2026)

Rode [`supabase/migrations/20261119002000_liga.sql`](../supabase/migrations/20261119002000_liga.sql).
Ele cria a contagem de pontos, a entrada nos grupos e o fechamento de domingo. Se o
Supabase tiver o pg_cron (vem em todos os projetos), ele agenda o fechamento para toda
segunda às 00h01; senão, a semana fecha sozinha na primeira visita à Liga. Sem esse
arquivo, a aba Liga mostra "Não consegui carregar a liga".

### Liga para todos (17/11/2026, noite)

Rode [`supabase/migrations/20261120001000_liga_todos.sql`](../supabase/migrations/20261120001000_liga_todos.sql)
depois do `20261119002000_liga.sql`. Ele põe todo mundo com cadastro completo num grupo de até
15, conta a respiração e os convites, ativa os convites de quem já treinou e refaz a semana atual
com os pontos recalculados.

Quem ainda não instalou nada usa só o `instalar.sql`, que já inclui tudo.

Nas próximas fases eu aviso quais arquivos novos de `supabase/migrations/` precisam ser
colados no SQL Editor, na ordem do nome.

### Lembretes (20/11/2026)

Rode, nesta ordem (veja a seção 6 para o resto da configuração):

1. [`supabase/migrations/20261120000100_lembretes_base.sql`](../supabase/migrations/20261120000100_lembretes_base.sql)
2. [`supabase/migrations/20261120000200_lembretes_motor.sql`](../supabase/migrations/20261120000200_lembretes_motor.sql)
3. [`supabase/migrations/20261120000300_lembretes_textos.sql`](../supabase/migrations/20261120000300_lembretes_textos.sql) (pode rodar de novo sempre que os textos mudarem)
4. [`supabase/migrations/20261120000400_lembretes_app.sql`](../supabase/migrations/20261120000400_lembretes_app.sql)

Os lembretes começam em **modo simulação**: o banco grava o que mandaria, mas não manda nada.

### Visitante: joga antes do cadastro (22/11/2026)

Rode [`supabase/migrations/20261122000100_visitante.sql`](../supabase/migrations/20261122000100_visitante.sql)
e siga a seção 7 (painel do Supabase, Cloudflare e Vercel). Sem a seção 7 o código por e-mail
não chega a ninguém fora da equipe do projeto. É esta migração que cria o `username`
(nulo até a pessoa escolher um, em `/perfil/username`): a leva de Perfil v2 abaixo só lê
essa coluna, não cria outra.

### Perfil v2 e busca de amigos (21/11/2026)

Detalhes em [`docs/PERFIL.md`](PERFIL.md). Rode, nesta ordem, cada migração desta leva
conforme ela for implementada (depois da migração do Visitante acima, que já cria o
`username` usado pela rota `/@username`):

1. [`supabase/migrations/20261121000400_perfil_objetivo.sql`](../supabase/migrations/20261121000400_perfil_objetivo.sql)
   — cria `pesagens`, a meta e a privacidade do peso, e as funções `peso_card`/`meta_semana`
   usadas pelo card de objetivo e pela meta da semana.
2. [`supabase/migrations/20261122000100_perfil_estatisticas.sql`](../supabase/migrations/20261122000100_perfil_estatisticas.sql)
   — cria `profiles.esconder_xp` e as funções `estatisticas_perfil`/`calendario_mes` da grade
   de estatísticas e do calendário em hexágonos.
3. [`supabase/migrations/20261122000200_amigos_busca.sql`](../supabase/migrations/20261122000200_amigos_busca.sql)
   — cria `seguidores`, `bloqueios`, a busca (`buscar_usuarios`) e a função `seguir_usuario`
   e afins. Precisa da extensão **pg_trgm**: se o `create extension` falhar por permissão,
   ative-a em **Database > Extensions** no painel do Supabase e rode a migração de novo.
4. [`supabase/migrations/20261123000100_perfil_social.sql`](../supabase/migrations/20261123000100_perfil_social.sql)
   — cria `profiles.vitrine_conquistas` e as funções `progresso_conquistas`, `definir_vitrine`,
   `feed_amigos`, `dar_high_five` e `minha_rede` (coluna da direita do perfil). É esta migração
   que fecha a definição final de `perfis_publicos` (identidade + username + objetivo/meta da
   semana + vitrine), depois que a migração do Visitante já tinha simplificado a view.

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

## 6. Lembretes (n8n, e-mail e push)

Quem faz o quê: o **banco** decide quem recebe o quê e com qual texto; o **n8n** chama o
banco a cada 15 min, envia os e-mails pelo Gmail e pede ao app para mandar os push; o
**app** manda o push, mostra a página de desativar e avisa o n8n das ações imediatas.
Regras e textos: FUNIL_LEMBRETES.md.

### 6.1 Configuração no banco (SQL Editor)

Gere um segredo longo (ex.: `openssl rand -hex 32`). Ele vai igual no banco e na Vercel.

```sql
-- 1. Segredo compartilhado (o mesmo de LEMBRETES_SEGREDO na Vercel e no n8n)
update public.lembretes_config set valor = to_jsonb('COLE-O-SEGREDO'::text) where chave = 'LEMBRETES_SEGREDO';
-- 2. Endereço do app nos links (sem barra no fim)
update public.lembretes_config set valor = '"https://hive-break.vercel.app"' where chave = 'APP_URL';
-- 3. Quem acessa /admin/lembretes
update public.lembretes_config set valor = (select jsonb_agg(id) from auth.users where email = 'SEU-EMAIL')
where chave = 'ADMINS';
-- 4. Senha do usuário do n8n
alter role n8n_lembretes with password 'OUTRA-SENHA-LONGA';
```

Outras chaves de `lembretes_config`: `LIMITE_EMAIL_DIA` (1), `LIMITE_PUSH_DIA` (3) e
`R0_AB_12H_PCT` (0): a porcentagem de pessoas no grupo "12h" do teste A/B do lembrete
diário.

Quando tudo estiver testado, **desligue a simulação**:

```sql
update public.lembretes_config set valor = 'false' where chave = 'LEMBRETES_SIMULAR';
```

### 6.2 Conexão do n8n com o banco

No Supabase, **Connect > Connection string > Session pooler** mostra o host e a porta do
seu projeto. Monte a credencial **Postgres** do n8n assim:

| Campo | Valor |
| --- | --- |
| Host | o do pooler, ex.: `aws-0-sa-east-1.pooler.supabase.com` (copie do painel: o prefixo `aws-0`/`aws-1` e a região mudam por projeto) |
| Port | `5432` (session pooler). O transaction pooler (`6543`) também funciona, mas o session aceita tudo o que o nó Postgres do n8n faz |
| Database | `postgres` |
| User | `n8n_lembretes.SEU-PROJECT-REF` (o ref é o `xxxx` de `https://xxxx.supabase.co`) |
| Password | a senha do passo 4 acima |
| SSL | `require` |

Como string: `postgresql://n8n_lembretes.SEU-PROJECT-REF:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require`

Esse usuário só pode executar `lembretes_pendentes()` e `lembrete_imediato()` e marcar
`status`, `enviado_em` e `erro` em `notification_log`. Não lê nenhum outro dado.

### 6.3 Workflows do n8n (contrato)

**A cada 15 min**: `select * from public.lembretes_pendentes();`
**Webhook** `POST /webhook/hive-lembrete-imediato` (confira o header `x-lembretes-segredo`):
`select * from public.lembrete_imediato($1::uuid, $2, $3::jsonb);` com `user_id`, `gatilho`
e `dados` do corpo.

As duas devolvem uma linha por envio, já reservada: `log_id, user_id, canal, gatilho, email,
nome, assunto, preheader, titulo, texto, cta_texto, url, link_desativar`. Para cada linha:

- `canal = 'email'`: nó Gmail para `email`, com `assunto`; no HTML, `preheader` escondido,
  `titulo` como manchete, cada linha de `texto` (separadas por `\n`) como um parágrafo, um
  botão `cta_texto` → `url` e, no rodapé, "Desativar lembretes" → `link_desativar`.
- `canal = 'push'`: `POST https://SEU-APP/api/lembretes/push` com o header
  `x-lembretes-segredo` e o corpo `{ "log_id": 123 }`. 200 = entregue.

Depois do envio:
`update public.notification_log set status = 'enviado', enviado_em = now() where id = $1;`
Na falha:
`update public.notification_log set status = 'falhou', erro = $2 where id = $1;`

Se o n8n cair entre a reserva e o envio, a linha fica `reservado` e **não** é reenviada
(melhor perder um lembrete que mandar dois).

### 6.4 Variáveis na Vercel

| Nome | Valor |
| --- | --- |
| `LEMBRETES_SEGREDO` | o mesmo segredo do passo 1 |
| `N8N_WEBHOOK_URL` | ex.: `https://SEU-N8N/webhook/hive-lembrete-imediato` |
| `VAPID_PUBLIC_KEY` | chave pública VAPID |
| `VAPID_PRIVATE_KEY` | chave privada VAPID (nunca em `NEXT_PUBLIC_`) |
| `VAPID_SUBJECT` | `mailto:contatohivebreak@gmail.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | a mesma chave pública |

Para gerar um par novo de chaves VAPID: `npx web-push generate-vapid-keys`. Trocar as
chaves invalida todos os aparelhos inscritos (cada pessoa precisa aceitar de novo).
Depois de criar as variáveis, faça um **Redeploy**.

### 6.5 Conferir

1. Entre com o seu usuário e abra `/admin/lembretes`. Escolha um gatilho e toque em
   **Disparar**: o disparo de teste ignora a simulação, os limites e as preferências.
2. Para receber push, conclua um desafio e aceite "Te aviso amanhã às…" (no iPhone, com o
   app instalado na tela inicial), ou ligue em **Perfil > Configurações > Lembretes**.
3. Com a simulação ligada, a lista do admin mostra o que o motor mandaria (`simulado`).


## 7. Visitante e código por e-mail

Especificação: [`docs/VISITANTE.md`](VISITANTE.md). O visitante é um usuário anônimo do
Supabase; o cadastro é username + código de 6 dígitos por e-mail; o Google vira alternativa.
Faça nesta ordem (os passos 1 a 5 podem ser feitos antes de publicar; o 6 liga o CAPTCHA e
só deve vir quando a chave do site já estiver na Vercel).

1. **SMTP próprio** (Authentication → Emails → SMTP Settings). Sem isso o Supabase só manda
   e-mail para a equipe do projeto, e cerca de 2 por hora.
   - Piloto: Gmail `contatohivebreak@gmail.com`, com verificação em 2 etapas ligada e uma
     **senha de app** (Conta Google → Segurança → Senhas de app). Host `smtp.gmail.com`,
     porta `465`, usuário = o e-mail, senha = a senha de app, remetente "Hive Break".
     Limite do Gmail: ~500 destinatários por dia, somando os lembretes.
   - Depois do piloto: domínio próprio + serviço transacional (Resend, Brevo) com SPF, DKIM e DMARC.
2. **Rate Limits** (Authentication → Rate Limits):
   - *Emails sent*: de 30/h para o tamanho do piloto (ex.: 200/h).
   - *Anonymous users*: o padrão é 30/h **por IP**. Num escritório todo mundo sai pelo mesmo IP:
     suba para pelo menos o número de pessoas que podem chegar juntas (ex.: 300/h).
3. **E-mail com código** (Authentication → Providers → Email): *Email OTP length* = **6** e
   *Email OTP expiration* = **600** segundos. A expiração vale também para os outros links de e-mail.
   Deixe *Secure email change* ligado.
4. **Templates** (Authentication → Emails → Templates): cole os HTML de
   [`docs/emails/`](emails/README.md) em **Magic Link** e **Change Email Address**, com o assunto
   `Seu código Hive Break: {{ .Token }}`.
5. **Login anônimo e vínculo** (Authentication → Sign In / Providers): ligue
   *Allow anonymous sign-ins* e *Allow manual linking* (o "Entrar com Google" da tela do
   visitante vincula o Google à conta dele).
6. **Turnstile** (CAPTCHA invisível):
   1. No Cloudflare: Turnstile → *Add widget*, domínio do app (e `localhost` para testar), modo
      **Invisible**. Guarde a *site key* e a *secret key*.
   2. Na Vercel: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = a site key. **Redeploy.**
   3. No Supabase: Authentication → Attack Protection (Bot and Abuse Protection) → ligue o
      CAPTCHA, provedor **Turnstile**, cole a *secret key*.
   Com o CAPTCHA ligado no Supabase e sem a site key no app, ninguém consegue começar como
   visitante nem pedir código de login.
7. **Migração**: rode `20261122000100_visitante.sql` **antes de publicar o app novo** (as telas
   novas chamam as funções dela). Ela agenda a limpeza
   diária no pg_cron (`hive-break-limpar-visitantes`, 04:23 UTC), que apaga visitantes não
   confirmados há mais de 7 dias.

### 7.1 Variáveis na Vercel

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | site key do Turnstile (passo 6) |
| `EXIGIR_EMAIL_ANTES_DO_DESAFIO` | `false` (padrão). `true` pede o código logo depois do username, antes de jogar (VISITANTE.md, seção 1.1) |

### 7.2 Conferir

1. Numa aba anônima, abra o link de convite de alguém: aparece o desafio e o placar a bater.
2. "Aceitar e jogar" → username → declaração → o desafio abre sem cadastro.
3. No fim, "Salvar meu resultado" → e-mail → o código chega com o número no assunto.
4. Depois de confirmar, o perfil segue para o resto do cadastro e a pessoa aparece na liga.
5. Funil: `select tipo, count(*) from public.eventos_visitante group by tipo;`

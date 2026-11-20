# Hive Break — Diagnóstico UX (Etapa 0)

> Gerado em 20/11/2026, a partir do `PLANO_ETAPAS_UX.md` (colado pelo Luan — o arquivo
> ainda não existe no repositório, só o `PROMPT_EXPERIENCIA_PONTA_A_PONTA.md` que o
> antecede). Só leitura: nenhum código foi alterado. Base: `docs/ESPECIFICACAO.md`,
> `docs/DECISOES.md`, `docs/METODOS.md`, `docs/HUD_TREINO.md`, `docs/PERFIL.md`,
> `docs/REFERENCIAS_PRODUTO.md`, `docs/RESGATE.md`, `docs/VISITANTE.md`,
> `docs/GANCHOS_CONVITE.md`, `docs/CONFIGURACAO.md` (os que existem em `docs/`;
> `TRILHAS.md`, `ESTRUTURA_DESAFIOS.md`, `REPERTORIO_TRILHAS.md`,
> `BIBLIOTECA_00_INDICE.md`, `abs_exercicios.json` e `abs_licoes.json`, citados no
> prompt da Etapa 0, **não estão no repositório** — se existirem em outro lugar,
> preciso que o Luan cole o conteúdo para comparar com o catálogo real) + leitura de
> `supabase/migrations/*.sql`, `src/dominio/*`, `src/exercicios/*`, `src/motor/*` e
> `src/app/**`.

---

## 0. Resumo executivo

- O código já implementa um produto **bem mais rico** do que a `ESPECIFICACAO.md`
  original: trilha em níveis → unidades → desafios → blocos, hive ao vivo, liga
  semanal "para todos", visitante (joga antes de cadastrar), perfil v2 com
  seguidores/objetivo/meta da semana, resgate, ganchos de convite, motor de
  lembretes via n8n e trilhas acessórias (Modo Escritório etc.). Isso é bom: o
  "trilho de código" do novo plano começa de uma base sólida, não de um MVP cru.
- Mas **o score de qualidade 0–100 e as estrelas da seção 9.1 da especificação nunca
  foram implementados**. As colunas existem no banco; nenhuma função do servidor as
  escreve. O que existe de verdade é XP + um rótulo de "score" que só diz *o que* é
  medido (reps, segundos...), não *quão bem*. Isso importa para o plano novo porque
  várias etapas (5, 8) presumem comparação de qualidade/recorde — hoje a única
  grandeza comparável é XP e os KPIs crus.
- O **catálogo de exercícios (19, igual à especificação) é 100% dado (JSON)**, lido
  por um motor genérico — isso já cumpre o espírito da Etapa 1. Mas o esquema desses
  JSON **não tem equipamento, família, função, contexto nem objeto** — nenhum dos
  conceitos que `PLANO_ETAPAS_UX.md` pede para a Etapa 1 e 6 existe hoje, nem como
  campo vazio. É extensão de esquema, não preenchimento de dado que já existe.
- O **conteúdo da trilha (níveis, unidades, desafios, blocos) não é dado versionado
  e editável**: é gerado por um script TypeScript de 341 linhas
  (`scripts/gerar-seed-trilha.ts`) que produz SQL, colado manualmente no SQL Editor
  do Supabase (`docs/CONFIGURACAO.md`). Não há pipeline automático nem CI que
  garanta que o banco bate com o que está no repositório.
- O **fluxo do primeiro acesso do visitante** (o caminho que importa para a Etapa 4
  do plano novo) já é curto — ~6 toques + 1 permissão de câmera + uma contagem de
  5 a 10 s — mas não há medição real de tempo; a meta de "60 s até a 1ª rep" do
  plano novo é mais apertada que os "90 s" da especificação original, e nenhuma das
  duas tem instrumentação hoje que prove o número.
- **Calibração:** de 19 exercícios, só 3 foram testados com pessoas reais
  (decisão 55 do `DECISOES.md`). Isso é um risco para qualquer feature do plano
  novo que confie na precisão da câmera (autoprogressão, fantasma do recorde).

---

## 1. Entidades e tabelas existentes

### 1.1 Visão geral

O banco tem **39 tabelas** (contadas direto nas migrations, `create table`), mais do
que as 30–32 que a especificação e as decisões citam — a diferença é tudo o que foi
adicionado depois da Fase 1 (visitante, hive ao vivo, liga, resgate, ganchos, perfil
v2, lembretes). Todas em `supabase/migrations/*.sql`, nunca editadas direto no
Supabase (exceto a colagem manual descrita em `docs/CONFIGURACAO.md`).

| Grupo | Tabelas |
| --- | --- |
| **Usuário** | `profiles`, `consents`, `health_screenings`, `baselines`, `pain_reports`, `notification_preferences`, `push_subscriptions` |
| **Conteúdo** | `exercises`, `levels`, `units`, `challenges`, `challenge_blocks`, `music_tracks`, `notification_templates` |
| **Jogo** | `level_sessions`, `challenge_attempts`, `attempt_blocks`, `user_challenge_progress`, `user_level_progress`, `user_chests`, `xp_events`, `streaks`, `streak_days`, `friendships`, `friend_streaks`, `nudges`, `invites`, `leagues`, `league_members`, `achievements`, `user_achievements`, `notification_log` |
| **Visitante** | `usernames_bloqueados`, `codigo_email_tentativas`, `eventos_visitante`, `visitante_migracoes` |
| **Hive ao vivo** | `hives`, `hive_participantes`, `high_fives` |
| **Convite / resgate** | `convite_eventos`, `resgates`, `resgate_eventos` |
| **Lembretes** | `lembretes_config`, `lembrete_gatilhos`, `lembrete_eventos` |
| **Perfil v2 / social** | `pesagens`, `seguidores`, `bloqueios`, `busca_log` |

### 1.2 Mapeamento para o vocabulário da especificação

| Conceito (especificação / plano novo) | Tabela(s) no código | Observação |
| --- | --- | --- |
| Trilha | implícito (todas as `levels` com `categoria = 'principal'`) | Não existe uma tabela "trilhas"; a trilha principal é convenção, não um registro |
| Nível / Seção | `levels` (+ `levels.categoria`: `'principal'` \| `'acessoria'`, migração 25/11) | 8 níveis principais + 4 "trilhas acessórias" (Hive Office, Coluna em Dia, Heat, Desacelerar) modeladas como níveis com 1 unidade cada |
| Unidade | `units` | Nasce na migração `20261117000600` (trilha em unidades, pedido do Luan) |
| Desafio / Lição | `challenges` | Tem `tipo` (`'desafio'` \| `'final'`) e hoje **duas** representações de conteúdo concorrentes — ver 1.3 |
| Bloco / Exercício dentro do desafio | `challenge_blocks` **e** `challenges.estrutura` (jsonb) | Ver 1.3: risco de divergência |
| Exercício (catálogo da câmera) | `exercises` (tabela, cópia) + `src/exercicios/*.json` (fonte real, lida pelo motor) | A decisão 68 do `DECISOES.md` já registra isso: "as regras usadas pela câmera vêm dos arquivos do app, não do banco" |
| Perfil | `profiles` | Bem mais colunas que a especificação original: `username`, `visitante`, `triagem_restricao`, `estilo_progresso`, `contagem_preparo_s`, `vitrine_conquistas`, `visibilidade_perfil`, `visibilidade_peso`, `esconder_xp`, `cor_capa`, `meta_hives_dia`, `meta_dias_semana`, `objetivo_principal` etc. |
| Progresso / XP / ofensiva / liga | `user_challenge_progress`, `user_level_progress`, `xp_events`, `streaks`/`streak_days`, `leagues`/`league_members` | Implementados; ofensiva ainda "em versão simples" (decisão 46): sem protetor, sem recuperação, sem marcos no código hoje (só os campos existem no schema de `streaks`) |
| Hive | `hives`, `hive_participantes` | Hive ao vivo (tempo real via Supabase Realtime); **não existe** ainda o conceito de "hive agendada" ou "hive de bolso" do plano novo |
| Objeto / equipamento improvisado (Etapa 1/6 do plano novo) | **não existe** | `profiles.equipamentos` só aceita `'tapete'` \| `'cabo_vassoura'`; não há tabela de objetos, carga, pegada ou segurança |
| Contexto de uso (Etapa 2 do plano novo) | **não existe** | Não há `contextos[]` em lição/exercício nem perfil de contexto (podeChao, podeSaltar, silencioso) |

### 1.3 Achado importante: duas representações de "bloco" convivendo

- `challenge_blocks` (tabela, desde a Fase 1): um registro por exercício do desafio,
  com `formato`, `series`, `descanso_s`, `parametros_por_dificuldade` (jsonb).
- `challenges.estrutura` (coluna jsonb, migração `20261118000900_blocos.sql`,
  "versão 2" do formato, documentada em `docs/METODOS.md`): a lista inteira de
  blocos com método, séries, esforço/reps-alvo, pausa, score, PSE, cadência, ADM e
  ação — o formato que `src/dominio/metodos.ts` e a tela (`Desafio.tsx`,
  `Execucao.tsx`) realmente leem.
- **O comentário da própria migração diz que a coluna `metodo` (formato anterior a
  esses dois) "fica vazia e deixa de ser usada"**, mas não diz o mesmo de
  `challenge_blocks`. E `finalizar_desafio` (`20261117000700_finalizar_desafio.sql`)
  **ainda lê de `challenge_blocks`** para validar os KPIs recebidos (conta quantos
  blocos o desafio tem, confere `ordem`, usa `parametros_por_dificuldade` para
  estimar a duração do bloco e limitar reps/tempo). Ou seja: hoje, para um desafio
  funcionar de ponta a ponta, o conteúdo tem que existir **nas duas** tabelas, em
  sincronia, gerado pelo mesmo script de seed. Isso é dívida técnica que a Etapa 1
  do plano novo (catálogo único) vai tropeçar se não for resolvida antes.

### 1.4 Lógica no servidor (funções SQL)

Principais funções (todas `security definer`, privilégios revogados de `anon`/
`authenticated` por padrão e concedidos função a função — decisão 25):

| Função | Papel |
| --- | --- |
| `ler_trilha()` / `ler_trilhas_acessorias()` | Monta o estado da trilha para a tela, numa chamada |
| `trilha_estados(user)` | Calcula concluído/travado/disponível/bloqueado por desafio (reescrita 3 vezes: `trilha_unidades`, `visitante`, `trilhas_acessorias` — a versão vigente é a última `create or replace`, mas a "régua" de como ela funciona está espalhada em 3 migrações) |
| `finalizar_desafio(challenge_id, modo, blocos)` | Entrada principal de resultado por câmera: valida KPIs, calcula XP, grava tentativa, ofensiva, progresso |
| `concluir_desafio_provisorio` | Caminho sem câmera (timer + "Concluí") — ainda existe em paralelo a `finalizar_desafio` |
| `criar_hive` / funções de `hive.sql` | Hive ao vivo |
| `username_verificar`, `criar_visitante`, `registrar_declaracao_saude`, `migrar_visitante` | Fluxo de visitante |
| `fechar_semana_liga`, `montar_ligas` (via pg_cron) | Liga semanal |
| `lembretes_pendentes()`, `lembrete_imediato()` | Motor de lembretes (consumido pelo n8n externo) |

---

## 2. Exercícios no código × catálogo dos docs

### 2.1 Os 19 exercícios existem e batem nome a nome com a especificação

`src/exercicios/*.json` (19 arquivos, carregados por `src/exercicios/index.ts`) tem
exatamente os 19 exercícios da seção 7 da `ESPECIFICACAO.md` — os 10 "de base" e os
9 de "yoga, equilíbrio, precisão, respiração e cabo de vassoura" —, mesmos nomes e
mesma modalidade. **Não encontrei `TRILHAS.md` / `BIBLIOTECA_00_INDICE.md` /
`abs_exercicios.json` no repositório** para comparar contra o catálogo maior que o
plano novo assume (repertório de famílias/variações, não só 19 exercícios) — se
esses documentos existirem fora do repo, preciso que sejam colados para fechar essa
comparação de verdade.

| id | nome | modalidade | câmera | validação | `variacao_facil` | `alternativas` (troca por limitação) |
| --- | --- | --- | --- | --- | --- | --- |
| agachamento_livre | Agachamento livre | força | frontal | repetições | `agachamento_parcial_cadeira` ⚠️ | `{ joelho: ponte_gluteo }` |
| afundo_alternado | Afundo alternado | força | lateral | repetições | — | — |
| flexao_braco | Flexão de braço | força | lateral | repetições | `flexao_joelhos` ⚠️ | — |
| ponte_gluteo | Ponte de glúteo | força | lateral | repetições | — | — |
| prancha | Prancha | core | lateral | sustentação | — | — |
| polichinelo | Polichinelo | cardio | frontal | repetições | `polichinelo_sem_salto` ⚠️ | `{ joelho: marcha_estacionaria }` |
| skipping | Skipping | cardio | frontal | repetições (alternado) | — | — |
| mountain_climber | Mountain climber | condicionamento | lateral | repetições (alternado) | — | — |
| elevacao_bracos_y | Elevação de braços em Y | mobilidade | frontal | repetições | — | — |
| alongamento_posterior | Alongamento de posterior | alongamento | lateral | sustentação | — | — |
| marcha_estacionaria | Marcha estacionária | aquecimento | frontal | repetições (alternado) | — | — |
| guerreiro_2 | Guerreiro II | yoga | frontal | sustentação | — | — |
| postura_arvore | Postura da árvore | yoga/equilíbrio | frontal | sustentação | — | — |
| cachorro_olhando_baixo | Cachorro olhando para baixo | yoga | lateral | sustentação | — | — |
| apoio_uma_perna | Apoio em uma perna | equilíbrio | frontal | sustentação | `apoio_uma_perna_com_toque` ⚠️ | `{}` (vazio) |
| toque_alvos | Toque nos alvos | precisão | frontal | precisão | — | — |
| respiracao_guiada | Respiração guiada | respiração | frontal | movimento (parado) | — | — |
| agachamento_bastao | Agachamento com bastão | mobilidade | frontal | repetições | — | — |
| bom_dia_bastao | Bom-dia com bastão | força/mobilidade | lateral | repetições | — | — |

⚠️ = **id referenciado em `variacao_facil` sem arquivo de definição correspondente**
em `src/exercicios/`. São 4 dos 19 exercícios (agachamento_livre, flexao_braco,
polichinelo, apoio_uma_perna) apontando para uma "versão fácil" que não existe como
exercício de verdade — se uma tela chamasse esse substituto hoje, não haveria
definição para o motor ler. Isso é exatamente o tipo de furo que o validador da
Etapa 1 do plano novo ("E1–E3 sem substitutoE0Id → erro") precisa pegar — mas aqui
o problema é mais básico: nem o "fácil" existe, e também não existe o conceito de
equipamento (E0–E3) nos exercícios de jeito nenhum (ver 2.2).

Só **2 dos 19** têm `alternativas` (troca automática por região do corpo que dói,
seção 12.4 da especificação): agachamento↔ponte_gluteo (joelho) e
polichinelo↔marcha_estacionaria (joelho). Os outros 17 não têm nenhuma alternativa
cadastrada — hoje, "senti dor" (`registrar_dor`) só registra e encerra o desafio sem
XP; **não troca o exercício automaticamente** (a troca por `alternativas` existe só
como dado no JSON, não vi nenhum código em `Execucao.tsx`/`Desafio.tsx` que a leia e
aplique em tempo real — a regra "dor no mesmo local em 2 desafios seguidos troca
automaticamente" da seção 12.4 não está implementada).

### 2.2 O esquema de exercício do motor não tem noção de equipamento, família, função ou contexto

`src/motor/tipos.ts` define `DefinicaoExercicio` (o que cada JSON precisa ter) e
**não existe nenhum campo `equipamento`, `familia`, `variacaoDe`, `degrau`,
`funcoes[]`, `regioes[]` ou `contextos[]`** — nem `agachamento_bastao.json` nem
`bom_dia_bastao.json` (que, pela especificação, pedem cabo de vassoura) têm qualquer
marcação de equipamento no próprio arquivo. O equipamento só existe uma camada
acima, em `exercises.equipamento` e `challenges.equipamento` (ambas colunas de
banco, check `in ('tapete', 'cabo_vassoura')`) — **desconectado** do arquivo que o
motor da câmera realmente lê. Ou seja: hoje não há *nenhum* dado para "promover" para
o catálogo da Etapa 1 nesses campos — é esquema novo, não migração de dado
existente. O catálogo de **objetos** do plano novo (garrafa, mochila, cadeira,
elástico...) não tem equivalente nenhum no código: nem tabela, nem campo, nem menção
em nenhum arquivo.

### 2.3 Motor: formatos e capacidades (o que já existe para a Etapa 1 reaproveitar)

`src/motor/tipos.ts` e `src/motor/motor.ts` já suportam, por exercício: medidas de
ângulo (2D/3D), distância, altura, inclinação e movimento; fases com histerese;
repetição simples, alternada (`alternado`, para marcha/skipping/mountain climber) e
sustentação; erros "durante" (mapeados por segmento do esqueleto, usados no HUD) e
"fim_rep"; `camera: "frontal" | "lateral"` por exercício (não por bloco — decisão 90
do `DECISOES.md`); visibilidade mínima de ponto (0,5) e suavização por filtro One
Euro. Isso é uma base técnica sólida para a Etapa 1 "estender", mas qualquer campo
novo (equipamento, contexto) precisa entrar no **motor**, não só numa camada de
metadados por fora, porque hoje o motor e o conteúdo são o mesmo arquivo JSON.

---

## 3. Métodos e scores implementados

### 3.1 Métodos — 7, batendo com `docs/METODOS.md`

`src/dominio/metodos.ts` (724 linhas) implementa exatamente os 7 métodos do MVP
(decisão 69/83): `intervalado`, `tabata`, `series`, `circuito`, `emom`, `escada`,
`contra_relogio`. `montarLinhaDoTempo` converte um bloco (método + parâmetros) numa
sequência de fases (prepare-se → esforço → pausa → troca); `SessaoTreino` percorre
essas fases em tempo real; `resumirMetodo` fecha o resultado por método no fim.
Mapeia 1:1 com a tabela da seção 3 de `docs/METODOS.md` (aquecimento → intervalado;
força → séries; HIIT → Tabata etc.) **no script de geração de conteúdo**
(`scripts/gerar-seed-trilha.ts`), não como regra viva no banco — ou seja, a "receita"
de qual método cabe em qual posição da unidade só existe nesse script; mudar a regra
depois que o conteúdo já foi semeado não migra o que já está no banco.

### 3.2 "Score" no código é um rótulo de medida, não a nota 0–100 da especificação

Esse é o achado mais importante da seção de riscos (ver 6.1). Dois conceitos com o
mesmo nome, implementados de jeitos totalmente diferentes:

- **`ESPECIFICACAO.md` §9.1** define Score = nota 0 a 100, combinando Execução
  (40%), Qualidade (40%) e Constância (20%), com estrelas por desafio (1/2/3) e por
  nível. Colunas `challenge_attempts.score`, `challenge_attempts.estrelas` e
  `attempt_blocks.score_bloco` existem no schema desde a Fase 1 (`jogo.sql`).
- **No código**, `Score` (`src/dominio/metodos.ts:20`) é só um tipo enumerado —
  `"total_reps" | "tempo_valido" | "tempo_total" | "reps_por_serie"` — que diz *qual*
  número é o resultado do bloco (rótulo exibido na tela, "Score: Total de
  repetições"). Não há peso, não há 0–100, não há estrelas.
- Confirmado por busca em todas as migrações: **nenhuma função do servidor escreve
  em `score`, `estrelas` ou `score_bloco`**. A única referência a "estrelas" fora do
  schema é `user_challenge_progress.melhores_estrelas`, que só faz
  `greatest(0, …)` sobre um valor que nunca chega diferente de 0 — a coluna existe,
  mas estrutural e permanentemente vazia na prática.
- O que de fato substitui "qualidade" hoje é o **XP** (fixo por desafio/tipo, com
  frações para modo manual e refazer — `finalizar_desafio`) e a **PSE** (esforço
  percebido, 1–10, autodeclarado). Não há nenhuma medida objetiva de "quão bem
  executado" persistida — a amplitude, o índice técnico etc. (seção 8.3 da
  especificação) existem como KPIs calculados no cliente e enviados em
  `attempt_blocks.kpis` (jsonb livre), mas **nunca agregados numa nota**.

### 3.3 Onde o cálculo acontece: cliente quase tudo, servidor só valida limites grosseiros

- **Cliente (100% do "miolo"):** detecção de pose, máquina de estados por
  exercício, contagem de reps/tempo válido, todos os KPIs (amplitude, cadência,
  técnica, simetria...), a montagem da linha do tempo do método e o resumo por
  método — tudo em `src/motor/*` e `src/dominio/metodos.ts`, executado no
  navegador. Isso é por design (seção 12.1/12.3: nenhuma imagem sai do aparelho) e
  está correto para a parte de visão computacional.
- **Servidor (`finalizar_desafio`):** recebe só o jsonb `kpis` por bloco e confere
  limites grosseiros — `reps_validas` entre 0 e `segundos × 4`, `tempo_valido_s` não
  passa do tempo do bloco + 5 s, tamanho do jsonb ≤ 20 KB, quantidade de blocos ≤ o
  que o desafio tem. **Não recalcula nem confere o conteúdo de `kpis` em si**
  (amplitude, técnica, qualquer coisa que a tela mostra como "score" do bloco): esse
  jsonb é gravado como veio. Ou seja, o antifraude da seção 9.5 da especificação
  ("o servidor recalcula o score a partir dos KPIs enviados e recusa valores
  impossíveis") está parcialmente implementado para **reps e tempo**, mas não existe
  para nenhuma outra métrica, porque não existe "score" para recalcular.
- `fora_quadro_pct` (usado para invalidar a tentativa na liga, seção 9.5) também
  vem pronto do cliente, sem recálculo no servidor.

---

## 4. Fluxo do primeiro acesso: telas, toques e tempo

Existem **dois** fluxos de primeiro acesso vivendo em paralelo no código — o
cadastro completo por Google (o original da especificação, `src/dominio/onboarding.ts`)
e o visitante por username (o atual, decisão do Luan em 18/11,
`src/dominio/visitante.ts`). O plano novo (Etapa 4) é sobre este segundo, que é o
caminho de entrada hoje (`/` → "Começar" → `/comecar`, não `/entrar`).

### 4.1 Visitante — do link à 1ª repetição contada

| # | Tela / evento | Rota / componente | Toque da pessoa | O que acontece |
| --- | --- | --- | --- | --- |
| 1 | Landing | `/` (`(publico)/page.tsx`) | Toque em **"Começar"** | — |
| 2 | Username | `/comecar` (`Comecar.tsx`) | Digita `@username` (checagem automática, 350 ms de espera) | `username_verificar` a cada pausa de digitação |
| 3 | Username | mesma tela | Toque na caixa **"Tenho 18 anos..."** + toque em **"Continuar"** | Abre o diálogo de declaração de saúde |
| 4 | Declaração 1/2 | `DeclaracaoSaude.tsx` (modal) | Toque em **"Respondo NÃO a todas"** (ou SIM) | — |
| 5 | Declaração 2/2 | mesmo modal | Toque em **"Li e estou ciente"** | Dispara, em sequência: Turnstile invisível → `signInAnonymously` → `criar_visitante` → `registrar_declaracao_saude` → calcula destino |
| 6 | Redireciona | `window.location.assign(destino)` | — | `destinoVisitante`: desafio do convite, ou **o primeiro desafio liberado da trilha** (hoje: aquecimento, marcha estacionária) |
| 7 | Pré-desafio | `/desafio/[id]` (`Desafio.tsx`) | Toque em **"Começar com a câmera"** | Pede permissão de câmera (diálogo nativo do navegador) |
| 8 | Preparo | `Execucao.tsx`, pop-up "PREPARE-SE" | Espera o corpo caber no quadro + contagem de **5 a 10 s** (configurável, padrão 10), ou toque em **"Ok, let's hive"** para pular | Motor começa a processar frames |
| 9 | Esforço | mesma tela | — | **Primeira repetição contada** |

**Total: 6 toques explícitos + 1 permissão nativa + uma espera de 5 a 10 s** (ou um
7º toque para pular a espera). Não há telemetria hoje que meça esse tempo de ponta a
ponta (não encontrei nenhum evento tipo `primeira_rep` ou `ftue_aberto` no código —
os eventos de visitante existentes são `visitor_started`-like, registrados em
`eventos_visitante`, mas focados no funil de cadastro, não no tempo até a 1ª rep).
Isso bate com a lista de eventos que a própria Etapa 4 do plano novo pede criar.

A meta de "60 segundos" do plano novo é mais apertada que os "90 segundos depois de
abrir a câmera" da seção 13.2 da especificação original — nenhuma das duas tem hoje
como ser verificada automaticamente.

### 4.2 Cadastro completo (Google) — ainda mais longo, mas não é o caminho de entrada

`src/dominio/onboarding.ts` define a sequência: termos → 9 telas de perfil
(apelido, nascimento, sexo, altura, peso, objetivo, atividade, dias/semana,
equipamento) → triagem (7 perguntas) → meta e compromisso → câmera → música →
nivelamento (ainda não implementado, "entra na Fase 3" segundo a decisão 34) →
trilha. `TOTAL_PASSOS = 1 + 9 + 4 = 14` telas. Esse caminho só é alcançado por
`/entrar`, hoje secundário (link pequeno, sublinhado, abaixo do botão principal).

### 4.3 Câmera negada / sem suporte

`Desafio.tsx` tem o botão "Fazer sem câmera (metade do XP)" sempre visível ao lado
de "Começar com a câmera" — a pessoa não precisa negar a permissão primeiro para
descobrir essa opção, já está exposta de cara (bom para o "nunca trava" do plano
novo). O modo manual vale a metade do XP e fica fora da liga (confirmado em
`finalizar_desafio`: `v_modo = 'manual'` corta o XP pela metade e `valido_para_liga`
só vira `true` via gatilho de XP, que só dispara para XP com `tipo` elegível — modo
manual não entra).

---

## 5. Como o conteúdo está guardado hoje

| Conteúdo | Formato real | Editável sem programar? |
| --- | --- | --- |
| Exercícios (19, regras de câmera) | **JSON** (`src/exercicios/*.json`), carregados por `index.ts` | Sim, em parte — mas precisa saber a sintaxe de condições/medidas do motor (não é um formato de alto nível) |
| Gabaritos (figura de palito) | TypeScript (`src/exercicios/gabaritos.ts`, 193 linhas) | Não |
| Trilha (níveis, unidades, desafios, blocos/estrutura) | **Gerado por script TS** (`scripts/gerar-seed-trilha.ts`, 341 linhas) → SQL (`supabase/seed_trilha.sql`) → **colado manualmente** no SQL Editor do Supabase (`docs/CONFIGURACAO.md`) | Não — qualquer mudança de conteúdo passa por editar o script e repetir o passo manual; nada garante que o banco em produção bate com o repositório |
| Trilhas acessórias (Hive Office etc.) | Mesmo padrão, `supabase/seed_trilha_acessoria.sql` | Não |
| Ganchos de convite (textos D/B/C) | **TypeScript, como array de dados** (`src/conteudo/ganchos.ts`), por pedido explícito do `GANCHOS_CONVITE.md` §5 | Sim, formato já é "dado" — bom precedente para a Etapa 1 |
| Textos de ofensiva/resgate | `src/conteudo/resgate-ganchos.ts` | Sim, mesmo padrão |
| Templates de notificação (push/e-mail) | Tabela `notification_templates` (conteúdo) | Sim, via SQL direto (não há UI admin para isso) |
| Regras de lembretes (textos, janelas) | `docs/FUNIL_LEMBRETES.md` (não encontrado em `docs/` — citado mas ausente) + migrações SQL | Não (a especificação está num doc ausente) |

**Esforço para virar "catálogo único como dado" (Etapa 1 do plano novo):**
baixo/médio para exercícios (já são JSON; falta estender o esquema com
equipamento/família/função/contexto/objeto e preencher esses campos — trabalho de
conteúdo, não de arquitetura); médio/alto para a trilha (sair do padrão
"script gera SQL colado à mão" para seeds JSON versionados que um validador de CI
consegue ler, exigindo decidir também o destino de `challenge_blocks` vs
`challenges.estrutura` primeiro, seção 1.3).

---

## 6. Riscos

### 6.1 Score/estrelas da especificação nunca existiram — e isso pode ser decisão tácita, não bug

Qualquer parte do plano novo que presuma "nota de qualidade 0–100" ou "estrelas"
precisa primeiro decidir se isso volta a ser construído (seção 9.1 da especificação
inteira ainda está por fazer) ou se é formalmente substituído pelo par
XP + PSE que já existe. Hoje convivem os dois nomes ("score") com significados
diferentes, o que é uma fonte de confusão garantida entre quem lê só a
especificação e quem lê só o código.

### 6.2 Antifraude real é mais fino do que a especificação sugere

O servidor confere limites de reps/tempo e tamanho do payload, mas **não recalcula
nenhum KPI de qualidade** (porque eles não existem server-side) nem confere
`fora_quadro_pct`. Um cliente alterado poderia mandar `kpis` arbitrários dentro dos
limites de reps/tempo sem ser pego. Isso é aceitável para o MVP atual (o que conta
para XP é só reps/tempo), mas vira risco maior se o plano novo passar a usar KPIs de
qualidade para decisões automáticas (autoprogressão da Etapa 5, por exemplo).

### 6.3 `challenge_blocks` × `challenges.estrutura`: duas fontes de verdade para o mesmo conteúdo

Detalhado na seção 1.3. Qualquer trabalho na Etapa 1 (catálogo único) ou Etapa 3
(motor de montagem) do plano novo vai precisar decidir isso primeiro, porque hoje
`finalizar_desafio` depende de `challenge_blocks` existir e estar sincronizado com o
que a tela mostra via `estrutura`.

### 6.4 Referências soltas no catálogo de exercícios

4 de 19 exercícios apontam `variacao_facil` para um id sem definição
(`agachamento_parcial_cadeira`, `apoio_uma_perna_com_toque`, `flexao_joelhos`,
`polichinelo_sem_salto`). 17 de 19 não têm nenhuma `alternativa` por região do
corpo. Nenhuma tela hoje consome `variacao_facil`/`alternativas` automaticamente —
"senti dor" encerra o desafio sem XP, não troca o exercício (a seção 12.4 da
especificação, "troca automática após dor recorrente", não está implementada).

### 6.5 Duração real × duração exibida: sem validação automática

`challenges.duracao_s` é um valor gravado no seed; a duração "de verdade" de um
desafio é recalculada em tempo real por `montarLinhaDoTempo`/`SessaoTreino` a partir
do método e dos parâmetros de cada bloco. Não encontrei nenhum teste ou validador
que confira se os dois batem (nem em `src/dominio/__tests__/metodos.test.ts`, que
testa a lógica dos métodos isoladamente, não contra o conteúdo semeado). Isso é
exatamente o validador que a Etapa 1 do plano novo pede criar (">10 s de diferença →
erro") — hoje não existe em nenhuma forma, nem manual.

### 6.6 Calibração: só 3 de 19 exercícios testados com pessoas reais

Decisão 55 do `DECISOES.md`: agachamento livre, polichinelo e apoio em uma perna
foram testados na Fase 0; os outros 16 "usam os valores iniciais da especificação e
foram testados só com sequências sintéticas". Ajustes de limiar já aconteceram
depois de 1 teste real do Luan (seção "Avaliação menos exigente", 18/11) — ou seja,
o histórico mostra que os valores iniciais erram bastante na primeira tentativa real.
Qualquer feature que dependa de confiabilidade de contagem em todo o catálogo
(fantasma do recorde, autoprogressão) herda esse risco.

### 6.7 `trilha_estados`: a regra de desbloqueio vive em 3 migrações, não em um lugar só

A função é redefinida (`create or replace`) em `trilha_unidades.sql`,
`visitante.sql` (acrescenta a regra de restrição de triagem) e
`trilhas_acessorias.sql` (acrescenta liberação automática de trilha acessória).
Funciona (Postgres usa sempre a última versão), mas para entender a regra vigente é
preciso ler as 3, na ordem — risco de manutenção para quem for adicionar os filtros
de contexto da Etapa 2 do plano novo.

### 6.8 Pipeline de conteúdo manual

`docs/CONFIGURACAO.md` documenta, para cada nova migração, "cole X no SQL Editor".
Não há script `npm run` nem CI que aplique migrações e seeds num Supabase real
(os testes usam PGlite embutido e um servidor Supabase falso em `e2e/`, não um
projeto real — decisão 32). Isso significa que o ambiente de produção pode ficar
dessincronizado do repositório sem que nenhum teste detecte.

### 6.9 Documentos citados pelo próprio prompt da Etapa 0 não estão no repositório

`TRILHAS.md`, `ESTRUTURA_DESAFIOS.md`, `REPERTORIO_TRILHAS.md`,
`BIBLIOTECA_00_INDICE.md`, `abs_exercicios.json`, `abs_licoes.json` — citados como
base deste diagnóstico e do plano novo inteiro — não existem em `docs/`. Isso limita
a seção 2 (comparação do catálogo real contra o catálogo "oficial" mais amplo que o
plano novo assume) ao que dá para inferir da `ESPECIFICACAO.md`. Também não
encontrei `FUNIL_LEMBRETES.md`, `SOCIAL_CRUZAMENTO_16.md`, `BRAND.md`,
`CARD_COMPARTILHAMENTO.md`, `BONUS_HIVE.md`, `DUELO.md`, `4HC_PRINCIPIOS.md`/
`4HC_GAMIFICACAO.md`, `CIENCIA_BREAKS.md`, `TRILHAS_ACESSORIAS.md` — todos citados
em `docs/DECISOES.md`/`docs/RESGATE.md`/`docs/VISITANTE.md`/`docs/GANCHOS_CONVITE.md`
como fonte de alguma regra, mas ausentes de `docs/`. O código implementa essas
regras (dá para inferir pelo comportamento e pelos nomes de função/coluna), mas a
*razão* por trás de cada limiar não está rastreável sem os documentos originais.

---

## 7. Pronto para a Etapa 1: decisões técnicas que o Luan precisa tomar

1. **Esquema do catálogo:** estender `DefinicaoExercicio` (`src/motor/tipos.ts`, o
   arquivo que o motor da câmera lê) com `equipamento`, `familia`, `variacaoDe`,
   `degrau`, `funcoes[]`, `regioes[]`, `contextos[]` e `objetos[]` — ou criar uma
   camada de metadados separada por cima, sem tocar no motor? Tocar no motor é mais
   simples de manter (um arquivo só por exercício), mas qualquer erro de digitação
   no JSON passa a poder quebrar a leitura de câmera, não só a listagem.
2. **`variacao_facil` solto:** criar as 4 definições que faltam
   (`agachamento_parcial_cadeira`, `apoio_uma_perna_com_toque`, `flexao_joelhos`,
   `polichinelo_sem_salto`) ou substituir essas referências por ids de exercícios
   que já existem, antes de ligar qualquer validador de "todo E1–E3 precisa de
   substituto E0".
3. **`challenge_blocks` vs `challenges.estrutura`:** migrar definitivamente para um
   só. Hoje `finalizar_desafio` ainda depende de `challenge_blocks` para validar
   KPIs enquanto a tela só lê `estrutura`. A Etapa 1 do plano novo (catálogo único)
   não tem como avançar sem resolver essa duplicação primeiro.
4. **Score 0–100 + estrelas:** voltam a ser implementados (seção 9.1 da
   especificação) ou são formalmente abandonados em favor de XP + PSE, que é o que
   existe de fato hoje? Isso afeta diretamente a Etapa 8 do plano novo (fantasma do
   recorde) — "recorde" hoje só pode ser definido em termos de reps/tempo por
   bloco, não de uma nota combinada.
5. **Pipeline de conteúdo:** manter o padrão "script TS gera SQL, cola à mão no
   Supabase" para o conteúdo de trilha, ou migrar para seeds JSON versionados (como
   já é o padrão dos exercícios) que um `npm run validar-catalogo` (Etapa 1) consiga
   ler e validar em CI? Essa escolha também decide se o validador da Etapa 1
   consegue cobrir a trilha inteira ou só o catálogo de exercícios.
6. **Prioridade da calibração:** os 16 exercícios ainda não testados com pessoas
   reais (decisão 55) deveriam ser recalibrados antes de qualquer feature que
   dependa de confiabilidade por exercício (autoprogressão da Etapa 5, fantasma do
   recorde da Etapa 8), ou isso pode esperar o piloto?
7. **Meta de tempo até a 1ª rep:** confirmar se vale a meta de 60 s do plano novo ou
   os 90 s da especificação original, e instrumentar os eventos (`ftue_aberto`,
   `primeira_rep` com ms desde abertura etc., como a própria Etapa 4 já pede) antes
   de otimizar o fluxo — hoje não há como medir o número real.
8. **Troca automática por dor:** a seção 12.4 da especificação (dor recorrente troca
   o exercício automaticamente) nunca foi implementada — "senti dor" só encerra sem
   XP. Isso entra na Etapa 5 (botão "Trocar") do plano novo, ou é uma lacuna da
   especificação original que vale corrigir separadamente, antes?

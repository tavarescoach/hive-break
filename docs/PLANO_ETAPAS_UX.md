# Hive Break · Plano de etapas: experiência ponta a ponta

> Criado em 19/11/2026. Execução do `PROMPT_EXPERIENCIA_PONTA_A_PONTA.md`.
> Dois trilhos em paralelo: **conteúdo** (revisão das trilhas, feita no chat do projeto) e **código** (etapas abaixo, feitas no Claude Code no repositório `tavarescoach/hive-break`).
> Cada etapa é uma fatia testável sozinha, com um prompt pronto para colar no Claude Code. Todo número de escolha nossa está marcado [validar].
> Stack conhecida pelos docs: Next.js (`src/app/(app)/…`), regras de domínio em `src/dominio/*.ts`, Supabase com migrations em `supabase/migrations/`.

## Visão geral

| Etapa | O que entrega | Por que nessa ordem | Depende de |
|---|---|---|---|
| **0** | Diagnóstico: código × base do projeto | ninguém sabe hoje quantos exercícios e regras já estão no código | — |
| **1A** | Fundação: uma fonte só de blocos, 4 exercícios que faltam, decisão do score, eventos do 1º acesso | o diagnóstico achou furos que travam todo o resto | 0 ✅ |
| **1B** | Catálogo estendido (metadados no JSON do exercício) + trilha como JSON + validador no CI | tudo o que vem depois lê daqui | 1A |
| **1C** | Importar a biblioteca para o motor (ABS 60 e GLU 36 primeiro) | hoje o código tem 19 exercícios; a base tem ~260 | 1B |
| **C** | Calibração no TTC (paralela, ferramenta + dia de teste com alunos) | só 3 de 19 exercícios foram testados com gente real | 1A |
| **2** | "Onde você está? Quanto tempo tem?" + filtros duros | é o que faz o app funcionar no escritório e no plantão | 1 |
| **3** | Motor de montagem da hive (1 · 3 · 5 · 8 min) | "sempre cabe" vira código, não planilha | 1, 2 |
| **4** | Primeiros 3 minutos (visitante → colocação → card → compromisso) | maior alavanca de retenção D1 | 3 |
| **5** | Rotas por nível (Trocar, autoprogressão, pular seção, Hard) | segura o avançado sem criar outra trilha | 1, 3 |
| **6** | Variantes improvisada e com acessório + carga declarada | cumpre "treine com o que tem aí" | 1, 5 |
| **7** | Modo interrompível, discreto e snacks (escritório e plantão) | lugares onde "não dá pra treinar" | 2, 3 |
| **8** | Repetir a dose (fantasma do recorde, revanche, dose do dia, Praticar) | transforma 1 treino em hábito | 3 |
| **9** | Compartilhar (desafio aberto por link, replay do esqueleto) | loop viral | 4, 8 |
| **10** | Medição (eventos, funil, taxa de repetição) | decidir com dado no piloto | desde a 0, fecha aqui |

**Trilho de conteúdo (em paralelo, no chat do projeto):** "revisa a trilha Modo Escritório" → Glutes → Core/Abs → Emagrecimento + Heat → Fight Mode → Yoga → Pilates → Hipertrofia. Cada revisão gera `TRILHA_<SIGLA>_V2.md` + seed JSON que a Etapa 1 consegue importar.

---

## Etapa 0 · Diagnóstico do repositório
**Entrega:** `docs/DIAGNOSTICO_UX.md` no repositório, sem mudar código.
**Critério de aceite:** tabela de exercícios no código × catálogo da base; lista de métodos/scores implementados; mapa das telas do fluxo do primeiro acesso com o número de toques até a 1ª rep.

```text
Contexto: Hive Break, game de atividade física no navegador (Next.js + Supabase), validação de movimento pela câmera. A base de conteúdo e decisões está nos docs do projeto (TRILHAS.md, ESTRUTURA_DESAFIOS.md, REPERTORIO_TRILHAS.md, BIBLIOTECA_00_INDICE.md, abs_exercicios.json, abs_licoes.json). Os que estiverem em docs/ no repositório, leia de lá; os que não estiverem, peça que eu cole.

Tarefa: faça um diagnóstico SÓ DE LEITURA, sem alterar código. Gere docs/DIAGNOSTICO_UX.md com:
1. Entidades e tabelas existentes (Supabase migrations + tipos TS): trilha, seção, unidade, desafio/lição, bloco, exercício, perfil, progresso, XP, ofensiva, liga, hive.
2. Exercícios presentes no código: id, nome, validação (contagem/tempo/alinhamento/guiado), posição de câmera, equipamento, se tem substituto E0. Compare com o catálogo dos docs: o que falta, o que está duplicado, nomes divergentes.
3. Métodos e scores implementados (AMRAP, ISOMETRIA, REPS, EMOM, TABATA, FOR_TIME; TOTAL_REPS, TEMPO_VALIDO etc.) e onde o cálculo acontece (cliente ou servidor).
4. Fluxo do primeiro acesso: liste cada tela, cada toque e cada permissão do link/ícone até a primeira repetição contada. Conte toques e estime segundos.
5. Como o conteúdo está guardado hoje (hard-coded em TS, JSON, banco) e o esforço para virar dado.
6. Lista de riscos: cálculo de pontos no cliente, lições cuja duração real não bate com a exibida, exercícios sem regra de câmera.
Termine com uma lista "pronto para a Etapa 1" de decisões técnicas que eu preciso tomar.
```

---

## Resultado da Etapa 0 (20/11/2026) e decisões propostas
Resumo do `docs/DIAGNOSTICO_UX.md`: o código é mais rico que a especificação (39 tabelas, visitante, hive ao vivo, liga, resgate, lembretes, acessórias), mas tem 19 exercícios, nenhum campo de equipamento/família/contexto no motor, duas fontes de blocos (`challenge_blocks` e `challenges.estrutura`), score 0–100 e estrelas nunca implementados, conteúdo da trilha gerado por script e colado à mão no Supabase, 4 `variacao_facil` apontando para exercícios inexistentes, e nenhuma medição do tempo até a 1ª rep (hoje: 6 toques + permissão + 5–10 s).

| # | Pergunta do diagnóstico | Proposta |
|---|---|---|
| 1 | Metadados no JSON do motor ou camada separada? | **No mesmo arquivo, numa chave `catalogo` separada**, validada por schema (zod) no CI. O motor ignora a chave; um erro de digitação quebra o CI, não a câmera. |
| 2 | `variacao_facil` sem definição | **Criar os 4** (agachamento parcial na cadeira, flexão com joelhos, polichinelo sem salto, apoio numa perna com toque). São justamente as versões E0/sem impacto/Mesa que o plano precisa. |
| 3 | `challenge_blocks` × `estrutura` | **`challenges.estrutura` vira a única fonte.** `finalizar_desafio` passa a ler dela; `challenge_blocks` fica congelada (sem novos registros) até poder ser removida. |
| 4 | Score 0–100 e estrelas | **Abandonar formalmente.** Recorde = melhor número cru por exercício e variante (reps válidas ou segundos válidos). É o que a pessoa entende e compartilha ("62 reps"). Colunas ficam marcadas como obsoletas, sem migração destrutiva agora. |
| 5 | Pipeline de conteúdo | **JSON versionado como fonte** (`content/`), script gera o SQL, validador no CI. Aplicar no Supabase continua manual por enquanto, mas o CI confere se o SQL gerado bate com o commitado. |
| 6 | Calibração | **Não travar o plano**, mas criar o campo `calibrado` por exercício. Só exercícios calibrados entram em autoprogressão e fantasma do recorde. Etapa C faz a calibração com alunos do TTC. |
| 7 | Meta de 60 s | **Manter 60 s e medir antes de otimizar** (eventos entram já na 1A). |
| 8 | Troca automática por dor | **Entra na Etapa 5** (botão Trocar, motivo "dói"). Até lá, "Senti dor" segue encerrando sem XP. |

Nota para a Etapa 4: hoje o username e a declaração de saúde vêm antes da 1ª rep. A declaração fica antes (obrigatória); o username pode ir para depois do resultado, já que o login anônimo (`signInAnonymously`) já existe. **Decidido (20/11): username depois da primeira hive**, pedido na tela de resultado junto do card ("Coloque seu @ no card"). Exceção: quem entra por convite numa hive ao vivo informa só um apelido antes de entrar, para os colegas verem quem é.

---

## Etapa 1A · Fundação
**Entrega:** fonte única de blocos, 4 exercícios novos no motor, decisão do score registrada, eventos do primeiro acesso.
**Critério de aceite:** todos os testes passam; um desafio criado só com `estrutura` funciona de ponta a ponta; os 4 exercícios carregam no motor e passam nos testes sintéticos; o evento `primeira_rep` é gravado com os ms desde a abertura.

```text
Contexto: Hive Break. Leia docs/DIAGNOSTICO_UX.md (seções 1.3, 2.1, 3.2, 4.1 e 7) e docs/PLANO_ETAPAS_UX.md (seção "Resultado da Etapa 0"). Execute SOMENTE a Etapa 1A.

1. Fonte única de blocos: altere finalizar_desafio (nova migration, create or replace) para validar KPIs a partir de challenges.estrutura, não de challenge_blocks. Mantenha a tabela challenge_blocks (sem apagar), mas pare de depender dela e deixe um comentário de obsoleta. Se attempt_blocks tiver FK para challenge_blocks, proponha a saída antes de mexer. Teste de ponta a ponta: desafio só com estrutura conclui, grava XP e progresso.
2. Crie os 4 exercícios referenciados em variacao_facil e que não existem: agachamento_parcial_cadeira, flexao_joelhos, polichinelo_sem_salto, apoio_uma_perna_com_toque. Mesmo formato dos outros 19 em src/exercicios/, registrados no index.ts e na tabela exercises (seed), com testes sintéticos no padrão dos existentes. Regras: agachamento parcial = descer até encostar na cadeira (joelho ~90°) e subir; flexão com joelhos = mesma regra da flexão com joelhos apoiados; polichinelo sem salto = abre um pé de cada vez com braços acima da cabeça, sem fase de voo; apoio numa perna com toque = pé livre pode tocar o chão até 2 vezes por série.
3. Score: registre em docs/DECISOES.md que o score 0–100 e as estrelas da ESPECIFICACAO §9.1 estão abandonados; recorde passa a ser o melhor número cru por exercício e variante (reps válidas ou segundos válidos). Comente as colunas score/estrelas/score_bloco/melhores_estrelas como obsoletas (sem apagar). Troque o rótulo "Score" na tela por "Conta como:" para não confundir.
4. Eventos do primeiro acesso: se já houver tabela de eventos (eventos_visitante), estenda; senão crie eventos (usuario_id, nome, props jsonb, criado_em, com RLS). Registre: ftue_aberto (ao abrir a landing), comecar_tocado, declaracao_aceita, camera_permitida, camera_negada, preparo_iniciado, primeira_rep (props: ms_desde_ftue_aberto, exercicio_id), desafio_concluido. Guarde o instante de ftue_aberto no sessionStorage para calcular os ms.
5. Crie docs/REGRAS_TRILHA.md explicando a regra vigente de trilha_estados (as 3 migrations que a redefinem, na ordem), sem mudar o código.
Abra um PR e mostre o resumo com o que mudou e os testes.
```

---

## Etapa 1B · Catálogo estendido + trilha como dado
**Entrega:** schema + seeds de exercícios, famílias, objetos e contextos; validador que roda no CI.
**Critério de aceite:** `npm run validar-catalogo` falha se algum exercício E1–E3 não tiver substituto E0, se alguma lição não declarar contextos, ou se a duração calculada divergir da exibida em mais de 10 s.

```text
Contexto: Hive Break (Next.js + Supabase). Etapa 1A concluída. Leia docs/DIAGNOSTICO_UX.md e a seção "Resultado da Etapa 0" de docs/PLANO_ETAPAS_UX.md. Execute SOMENTE a Etapa 1B.

Tarefa: transformar o conteúdo de treino em dado versionado, com um catálogo único.
0. Decisões já tomadas: os metadados ficam no MESMO JSON de cada exercício em src/exercicios/, numa chave "catalogo" que o motor ignora, validada por schema zod; a fonte da trilha passa a ser JSON em content/trilhas/ (converta uma vez a saída atual de scripts/gerar-seed-trilha.ts), e um script gera o SQL a partir dele (npm run seed:sql). O CI falha se o SQL commitado não bater com o gerado.
1. Tipos em src/dominio/catalogo.ts (schema zod + tipos):
   - Exercicio.catalogo: nome (PT-BR), nomeOriginal?, familia, variacaoDe?, degrau (int), funcoes[] (1–3: agachar, dobrar, avancar, empurrar, puxar, carregar, anti-extensao, anti-rotacao, anti-inclinacao, flexao-coluna, extensao-coluna, rotacao, equilibrio, mobilidade, alongamento, potencia, cardio, golpe, respiracao, relaxamento), regioes[], posicaoCamera (frente | lado | 45 | aos-pes), validacao (V1 | V2 | V3 | V4), equipamento (E0 | E1 | E2 | E3), objetos[] (ids do catálogo de objetos), substitutoE0Id?, versaoSemImpactoId?, flags { semChao, semSalto, semSuor, silencioso }, pesoPorTrilha { [trilhaId]: "P" | "S" | "E" }, calibrado (bool; true só para agachamento_livre, polichinelo e apoio_uma_perna, decisão 55).
   - Objeto: id, nome, cargaKgMin, cargaKgMax, pegada (uma-mao | duas-maos | alca | abracado), seguranca (texto curto), cocoClass?.
   - Contexto: id (mesa | sala | plantao | viagem | casa | ar-livre), regras { semChao, semSalto, semSuor, silencioso, interrompivel }.
   - Licao: formato de abs_licoes.json + contextos[] + variantes { curta3?, snack1?, avancada?, improvisada?, acessorio?, semImpacto? }.
2. Preencha a chave catalogo dos 23 exercícios existentes (19 + 4 da 1A). Seeds em content/ (JSON) para objetos e contextos. Objetos iniciais: garrafa 0,5/1,5/2 L, galão 5 L, garrafão 10–20 L (só avançado), mochila leve/média/pesada, bolsa/sacola, mala, cadeira fixa, mesa firme, parede, degrau, toalha, mini band, elástico com alça, superband, halteres leves, caneleira, kettlebell.
3. Script scripts/validar-catalogo.ts (npm run validar-catalogo), rodando no CI:
   - E1–E3 sem substitutoE0Id → erro.
   - exercício com salto sem versaoSemImpactoId → erro.
   - lição sem contextos → erro; lição com exercício incompatível com um contexto declarado → erro.
   - duração calculada (series × esforco + (series − 1) × pausa, somando blocos e pausas entre blocos) diferente da exibida em > 10 s → erro.
   - mais de 1 troca de posicaoCamera numa lição → aviso.
   - mais de 1 exercício novo por lição dentro da seção → aviso.
   - variacao_facil ou substituto apontando para id inexistente → erro.
4. Não mude telas nesta etapa. O app continua funcionando igual.
Testes: unitários do validador com casos que passam e que falham para cada regra. Abra um PR com o resumo.
```

---

## Etapa 1C · Importar a biblioteca para o motor
**Entrega:** conversor das regras da biblioteca (máquina de estados com variáveis θT, LC, AJ etc.) para o formato do motor, começando pelos 60 do ABS e os 36 do GLU.
**Critério de aceite:** os testes da câmera dos próprios docs (ABS §5 e GLU §4: "conta 1", "incompleta", "oscilação", "rápida demais", V2) passam no motor para cada exercício importado. Exercícios importados entram com `calibrado: false`.
**Antes:** subir em `docs/` os arquivos `ABS_EXERCICIOS.md`, `abs_exercicios.json`, `abs_licoes.json`, `GLU_EXERCICIOS.md`, `TRILHAS.md`, `ESTRUTURA_DESAFIOS.md`, `REPERTORIO_TRILHAS.md` e `BIBLIOTECA_00_INDICE.md`.

```text
Contexto: Hive Break. Etapas 1A e 1B concluídas. Leia docs/ABS_EXERCICIOS.md (§1 convenções e variáveis, §3–§5 regras e testes), docs/abs_exercicios.json e docs/GLU_EXERCICIOS.md (§1–§4). Execute SOMENTE a Etapa 1C.

1. Mapeie cada variável dos docs (θT, θP, θC, AQ, AJ, AC, LC, LJ, θO, θL, θV, inc, XP, xJ, dPJ, dCJ, dJC, hP, hJ, vPO, Δ, δ e as medidas do GLU) para as medidas que o motor já tem em src/motor/tipos.ts. Onde faltar (ex.: ângulo com sinal 0–360°, linha de base deitada no 1º segundo do bloco, normalização por T/W/L, "último valor bom por até 5 quadros"), estenda o motor com o mínimo, com testes.
2. Script scripts/importar-biblioteca.ts: lê abs_exercicios.json (e uma tabela equivalente do GLU que você gerar a partir do .md) e escreve um JSON por exercício em src/exercicios/ no formato do motor, já com a chave catalogo (família, degrau pela escada do doc, equipamento, substituto E0, câmera, flags; calibrado: false).
3. Gere os testes de câmera de cada exercício a partir das tabelas de teste dos docs (V1: conta 1 / incompleta / oscilação / rápida; V2: dentro / fora 0,3 s / fora 1 s / volta). Todos precisam passar.
4. Duplicatas: onde um exercício importado for o mesmo que um dos 23 existentes (ex.: agachamento livre = GLU-25, prancha = ABS-32, ponte = GLU-01, mountain climber = ABS-42), mantenha o id atual e a regra que JÁ foi calibrada com gente real; liste as diferenças de limiar num relatório docs/IMPORTACAO_BIBLIOTECA.md para eu decidir.
5. Não coloque os novos exercícios na trilha ainda (isso vem da revisão de conteúdo). Só no catálogo e no treino livre, se já existir filtro.
Abra um PR com o relatório.
```

---

## Etapa C · Calibração (paralela, a partir da 1A)
**Entrega:** modo calibração no app + protocolo para um dia de teste com alunos do TTC.
**Critério de aceite:** relatório por exercício com a concordância entre a contagem do app e a do professor; exercício com concordância ≥ 90% em pelo menos 5 pessoas vira `calibrado: true` [validar].

```text
Contexto: Hive Break. Só 3 de 19 exercícios foram testados com pessoas reais (DECISOES.md, decisão 55). Execute SOMENTE a Etapa C.

1. Rota /admin/calibracao (só para meu usuário): escolho o exercício, a pessoa executa uma série com a câmera e eu toco num botão grande "+1" a cada repetição que considero válida (ou seguro o botão enquanto a posição está válida, nos de tempo). Nenhuma imagem é gravada.
2. Gravar por série: contagem do app, contagem do professor, tempo válido do app × do professor, fps médio, posição do celular, e a série temporal da variável principal (para eu reajustar limiares depois).
3. Relatório por exercício: concordância (%), erros mais comuns (app contou e professor não; professor contou e app não), sugestão de ajuste de limiar com base na série temporal.
4. Botão "marcar como calibrado" quando houver ≥ 5 pessoas com concordância ≥ 90% [validar].
```

---

## Etapa 2 · "Onde você está? Quanto tempo tem?"
**Entrega:** seletor de 2 toques antes da lição + perfil de contexto; filtros duros aplicados.
**Critério de aceite:** no contexto Mesa nenhuma lição com chão, salto ou suor aparece; a escolha fica lembrada por faixa de horário; dá para pular o seletor ("usar o de sempre").

```text
Contexto: Hive Break. Catálogo único pronto (src/dominio/catalogo.ts, content/). Marca: BRAND.md (voz leve, direta; amarelo #FFC42E, fundo #0D0E11, cartão #17191E).

Tarefa:
1. Perfil de contexto (migration Supabase + tipos): podeChao, podeSaltar, silencioso, temEscada, objetos[] (ids), contextoPadraoPorHorario (jsonb: faixas manhã/tarde/noite/madrugada → contextoId), dores[] já existente se houver.
2. Bottom sheet "Bora um break?" antes de iniciar qualquer lição ou treino livre:
   - Linha 1 · Onde você está: Mesa · Sala · Plantão · Viagem · Casa · Ar livre (ícones grandes, 1 toque).
   - Linha 2 · Quanto tempo: 1 · 3 · 5 · 8 min.
   - Linha 3 (opcional, recolhida) · O que tem aí: chips dos objetos.
   - Botão "Usar o de sempre" quando houver padrão para a faixa de horário.
   Tudo cabe sem rolar a tela num celular de 360 × 640.
3. src/dominio/filtros.ts: função pura filtrarExercicios(catalogo, contexto, perfil, objetosAgora) aplicando regras do contexto + perfil como filtro duro, antes de qualquer peso P/S/E.
4. Guardar a última escolha por faixa de horário e sugerir na próxima vez.
Testes: tabela de casos (contexto × flags do exercício → aparece/não aparece), incluindo Plantão (sem chão, sem salto, suor leve ok) e Viagem (silencioso).
```

---

## Etapa 3 · Motor de montagem da hive
**Entrega:** `montarHive({ trilha, licaoAtual, tempo, contexto, objetos, nivel, historico })` determinística.
**Critério de aceite:** para 1/3/5/8 min a duração final fica a ±10 s do prometido; a âncora da lição é preservada; troca de posição de câmera ≤ 1.

```text
Contexto: Hive Break. Catálogo (Etapa 1) e filtros de contexto (Etapa 2) prontos. Regras de montagem em REPERTORIO_TRILHAS.md §3 e ESTRUTURA_DESAFIOS.md.

Tarefa: criar src/dominio/montarHive.ts, função pura e determinística (mesma entrada → mesma saída; use semente = usuarioId + data + licaoId):
1. Entrada: trilhaId, licaoId, tempoAlvo (60 | 180 | 300 | 480 s), contextoId, objetosAgora[], nivel (degrau atual por família), historico (exercícios feitos, recordes).
2. Regras:
   - Usa a lição da trilha como base. 5 min = lição; 3 min = variante curta3 (ou corta séries mantendo a âncora); 1 min = snack1 (1 bloco de 60 s, sem aquecimento); 8 min = lição + bloco de rodízio + volta à calma curta.
   - Exercício incompatível com o contexto → substitui pelo substitutoE0 ou por outro da mesma função e degrau.
   - Ordem: estabilidade → força/potência → condicionamento; em empate, agrupa por posição de câmera; no máximo 1 troca de posição.
   - No máximo 1 exercício novo para o usuário por hive.
   - Ajusta séries/pausas para fechar no tempo alvo ±10 s, sem baixar pausa abaixo de 10 s.
3. Saída: hive com blocos, duração calculada, aviso único de câmera ("Hoje: celular na mesa, de frente"), lista de objetos usados, flag ehNovo por exercício.
4. Card de prévia antes do "Let's hive": blocos, tempo, posição, equipamento e "1 exercício novo" (REPERTORIO_TRILHAS.md §6.10).
Testes: snapshot de 10 combinações (trilha × tempo × contexto), testes de propriedade para duração ±10 s e ≤ 1 troca de câmera, e caso "nenhum exercício compatível" (cai para mobilidade E0 de pé e registra aviso).
```

---

## Etapa 4 · Primeiros 3 minutos
**Entrega:** fluxo visitante → contexto → câmera com encaixe → Hive de boas-vindas (colocação) → resultado → compromisso → username.
**Critério de aceite:** do link à 1ª rep contada em ≤ 60 s num celular médio; câmera negada não trava; colocação grava o degrau inicial por família.

```text
Contexto: Hive Break. Docs: VISITANTE.md, BRAND.md, HUD_TREINO.md, CARD_COMPARTILHAMENTO.md, 4HC_PRINCIPIOS.md (§8 e §9). Cadastro decidido: username + código por e-mail, só DEPOIS da primeira hive.

Tarefa: implementar o primeiro acesso.
1. Rota de entrada (link e ícone) abre "Bora um break de 2 minutos?" com Let's hive. Sem login.
2. Tela de 2 toques: "Onde você está?" (contextos da Etapa 2) e "Por que agora?" (texto livre, opcional, pular em 1 toque). Guardar localmente e migrar para o perfil no cadastro.
3. Câmera: antes do pedido de permissão mostrar "Ninguém vê sua câmera, só seus números." Assistente de encaixe com a silhueta do esqueleto (amarelo #FFC42E) até o corpo caber; dica rotativa de onde apoiar o celular (garrafa, livro, parede). Permissão negada → modo guiado com timer (V4), sem bloquear.
4. Hive de boas-vindas = colocação (montarHive com tempo 150 s):
   - Casa/Viagem/Sala: agachamento AMRAP 40 s + prancha alta ou isometria de cadeira 20 s.
   - Mesa/Plantão: sentar e levantar da cadeira AMRAP 40 s + cadeira isométrica 20 s.
   - Regra de colocação em src/dominio/colocacao.ts com faixas por exercício → iniciante / intermediário / avançado e degrau inicial por família [validar faixas; deixe constantes nomeadas].
5. Resultado: número herói, "Você começou no nível X", 1ª figurinha da Hivepédia, botão do card.
6. Compromisso: "Amanhã, que horas?" com 3 sugestões (hora atual, 15h, 20h) + outro → cria o lembrete. Logo abaixo, "Repetir: dias úteis / todo dia / só amanhã" e o botão "Colocar na agenda":
   - Google Agenda: abrir em nova aba o link de modelo https://calendar.google.com/calendar/render?action=TEMPLATE com text="Hive Break · 3 min", dates (início/fim em UTC ou com ctz=America/Sao_Paulo), details (frase + link de volta para a lição/revanche com utm), recur=RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR (ou FREQ=DAILY). Sem login nem permissão; a pessoa só toca em Salvar.
   - "Outra agenda (iPhone, Outlook)": gerar e baixar um .ics (VEVENT com RRULE, VALARM de 0 min, URL do app). Gerar no cliente; nada sobe para o servidor.
   - Não usar a API do Google Calendar com OAuth (exige login com Google, que saiu do cadastro, e verificação de escopo pelo Google).
   - Evento: agenda_adicionada {tipo: google | ics, recorrencia}.
7. Só então: username + código por e-mail para salvar a ofensiva. Resultado do visitante migra para a conta.
8. Copy dos dias 1–4: "Os 3 primeiros dias são os mais chatos. Depois fica bom." + bônus no dia 4; marco "5 de 5".
Métricas (eventos): ftue_aberto, contexto_escolhido, camera_permitida/negada, primeira_rep (com ms desde aberto), boas_vindas_concluida, nivel_colocado, compromisso_horario, cadastro_concluido.
Testes: colocação (tabela de entradas → nível), migração visitante → conta, fluxo sem câmera.
```

**Achado do teste em preview da Etapa 1A (27/11/2026):** um desafio inteiro rodou com o corpo
99–100% fora do quadro (câmera mal enquadrada) sem nenhum aviso na tela — o enquadramento
(`avaliarEnquadramento`) já existe e aparece no pop-up "PREPARE-SE" antes de começar, mas nada
avisa DURANTE o bloco se a pessoa sai do quadro (o HUD só mostra `corpoVisivel`/`lento`, sem
destaque). Isso derruba a 1ª experiência exatamente no momento em que mais importa (resultado
final sem nenhuma rep válida, sem explicação). Entra como parte do "assistente de encaixe" desta
etapa: um aviso persistente e óbvio em tela enquanto o corpo estiver fora do quadro durante o
próprio bloco, não só antes dele.

---

## Etapa 5 · Rotas por nível
**Entrega:** botão Trocar, autoprogressão, teste para pular seção, chip "Versão Hard" e unidade "Lendária".
**Critério de aceite:** avançado chega à variante difícil em ≤ 2 toques; iniciante que trava recebe regressão sem perder XP; ranking e duelo comparam só a mesma variante.

```text
Contexto: Hive Break. Famílias e degraus no catálogo (Etapa 1). Regras em PROMPT_EXPERIENCIA_PONTA_A_PONTA.md Passo 4 e REPERTORIO_TRILHAS.md §6.3.

Tarefa:
1. Botão "Trocar" em todo bloco, com motivos: não consigo · sem equipamento · dói · não gosto · quero mais difícil. Cada motivo escolhe substituto da mesma função: degrau −1, substitutoE0, mesma função outro exercício (e grava em evitar[] se "não gosto"), degrau +1. "Dói" mostra o aviso fixo de procurar um profissional e não grava dado de dor detalhado.
2. Autoprogressão em src/dominio/progressao.ts (servidor): 2 lições seguidas com ≥ 110% da meta no bloco âncora → oferece degrau +1 ("Subir de nível?"); < 60% ou "difícil demais" → oferece degrau −1. Constantes nomeadas [validar].
3. Teste para pular seção: desafio de 3 min com meta; passou → libera a próxima seção e marca as lições puladas como "dispensadas" (sem XP retroativo).
4. Chip "Versão Hard" no card de prévia: aplica variantes.avancada. "Lendária": refazer unidade concluída com parâmetros +1 alavanca; recompensa de vitrine, fora da liga.
5. Comparações justas: recorde, duelo, card e ranking da hive guardam a variante (e0 | improvisada | acessorio | avancada | degrau N) e só comparam iguais. Card coletivo da hive mista mostra % da própria meta.
Testes: escolha de substituto por motivo, regras de autoprogressão (sequências de scores), pular seção, comparação só entre variantes iguais.
```

---

## Etapa 6 · Improvisados e acessórios
**Entrega:** variantes improvisada e com acessório nas lições, carga declarada, aviso de segurança do objeto, coleções por material no treino livre.
**Critério de aceite:** com "mochila" marcada, a lição de Glutes oferece hip thrust com mochila com a linha de segurança; volume com carga aparece no histórico.

```text
Contexto: Hive Break. Catálogo de objetos (Etapa 1), montarHive (Etapa 3), Trocar (Etapa 5). Tabela de objetos e regras em PROMPT_EXPERIENCIA_PONTA_A_PONTA.md Passo 5.

Tarefa:
1. montarHive aplica variantes.improvisada quando o objeto estiver em objetosAgora, e variantes.acessorio para E2/E3, sempre mantendo a versão E0 disponível em 1 toque.
2. Antes do bloco com objeto: cartão de 2 s com o objeto, a carga sugerida e a linha de segurança (ex.: "Cadeira sem rodinha, encostada na parede."). Primeira vez com aquele objeto = aviso prévio obrigatório.
3. Carga declarada: seletor rápido (kg ou leve/média/pesada, com tabela de conversão por objeto). Gravar no resultado do bloco; volume = reps × kg; progressão de carga entra como alavanca 5.
4. Treino livre: coleções "Com o que tem aí" (filtra por objetos marcados) e por material (elástico, halter, mochila, garrafa).
5. Itens proibidos no catálogo (validador da Etapa 1 deve barrar): objeto instável acima da cabeça, subir em cadeira, cadeira com rodízio, garrafão 10–20 L para nível iniciante.
Testes: seleção de variante por objeto, conversão de carga, bloqueios de segurança, comparação de recorde separada por variante.
```

---

## Etapa 7 · Escritório e plantão: interrompível, discreto e snacks
**Entrega:** modo interrompível, modo discreto (sem câmera, sem som), snack de 1 min, micro-break de 30 min e pacotes Mesa/Plantão.
**Critério de aceite:** sair do app no meio do bloco e voltar em até 30 min retoma do bloco; blocos completos já contam; modo discreto conta ofensiva e não conta liga.

```text
Contexto: Hive Break. Contextos (Etapa 2) e montarHive (Etapa 3). Ciência e regra de breaks em CIENCIA_BREAKS.md §2. Regra: V4 não gera XP de câmera nem conta na liga.

Tarefa:
1. Interrompível: estado da hive salvo a cada bloco (local + servidor). Pausa > 2 min ou app em segundo plano → "Pausado. Seus blocos já contam." Ao voltar (até 30 min, decidido em 20/11) retoma do bloco interrompido; depois disso fecha com os blocos concluídos. Nunca quebra ofensiva por interrupção.
2. Modo discreto: liga em 1 toque no seletor; sem câmera, sem som (vibração ou fone), só exercícios com flag silencioso e sem chão; timer guiado. Conta ofensiva, não conta liga (decidido em 20/11).
3. Snack de 1 min: atalho na home ("1 minuto agora") que usa montarHive(tempo 60). Decisão do Luan: o snack conta para a ofensiva do dia e dá XP pequeno [validar valor], mas NÃO marca lição como concluída nem avança a trilha.
4. Micro-break: lembrete opcional a cada 30 min no horário de expediente configurado ("Levanta 1 min"), pausável durante reuniões; sem câmera, sem social.
5. Pacotes: "Mesa" (3 hives de 3 min: pescoço/ombro, coluna/quadril, energia das 15h), "Plantão" (snack de alerta na madrugada, 3 min de pernas e circulação, Desacelerar pós-plantão), "Teleatendimento" (2 pausas de 10 min, NR-17 Anexo II). Conteúdo vem das trilhas Modo Escritório, Hive Office e Desacelerar.
Testes: retomada após interrupção (tempos 1 min, 10 min, 40 min), contagem de ofensiva × liga no modo discreto, filtro do pacote Plantão.
```

---

## Etapa 8 · Repetir a dose
**Entrega:** fantasma do recorde no HUD, revanche agendada, dose do dia por horário, Praticar e Hivepédia.
**Critério de aceite:** em lição já feita, o HUD mostra o fantasma; a tela de resultado oferece revanche para amanhã com o número no texto do lembrete.

```text
Contexto: Hive Break. HUD em HUD_TREINO.md (barra segmentada, herói reps/tempo, amarelo; coral nos últimos 5 s). Lembretes em FUNIL_LEMBRETES.md. XP decrescente ao repetir o mesmo desafio no mesmo dia (4HC).

Tarefa:
1. Fantasma do recorde: para cada bloco com recorde da mesma variante, guardar a série temporal de reps (1 ponto por segundo). No HUD, marcador fino na barra mostrando onde o recorde estava naquele segundo. Ultrapassar = som curto + vibração + texto "Passou o fantasma" (1 s). Nunca dois números grandes lado a lado.
2. Revanche: na tela de resultado, "Bater {recorde} amanhã?" → agenda lembrete no mesmo horário com o número no texto.
3. Dose do dia: card na home que muda por faixa de horário e contexto padrão (manhã mobilidade; pós-almoço lanche de movimento; 15h energia; noite Desacelerar; madrugada em Plantão snack de alerta).
4. Praticar: missão que traz exercícios aprendidos há ≥ 7 dias com score abaixo da mediana pessoal.
5. Hivepédia: figurinha desbloqueada na primeira validação de cada exercício (tabela exercicio_desbloqueado), contador de coleção e selo "novo!" na prévia.
Testes: cálculo do fantasma, seleção da dose do dia, critérios do Praticar, desbloqueio único de figurinha.
```

---

## Etapa 9 · Compartilhar por desenho
**Entrega:** desafio aberto por link e replay do esqueleto de 5 s.
**Critério de aceite:** quem abre o link de desafio entra direto naquele desafio como visitante, sem login, e vê a comparação no fim; o replay não contém nenhum pixel da câmera.

```text
Contexto: Hive Break. CARD_COMPARTILHAMENTO.md, DUELO.md, VISITANTE.md, GANCHOS_CONVITE.md. Selfie nunca sobe para o servidor.

Tarefa:
1. Desafio aberto: botão "Desafiar" no resultado gera link curto /d/{codigo} com desafio, variante e score a bater. Abertura sem login → montarHive com o mesmo desafio e variante → resultado com "Você fez X, {nome} fez Y" → convite para criar username. Atribuir o convite a quem compartilhou (métrica K-factor). Open Graph com imagem gerada (número a bater, nome do desafio).
2. Replay do esqueleto: durante o melhor trecho (ou os últimos 5 s), desenhar em canvas só o esqueleto e o contador; gravar com MediaRecorder (webm/mp4 conforme suporte); compartilhar com Web Share API (files) ou baixar. Sem vídeo da câmera no canvas.
3. Card automático nos momentos de orgulho: recorde, degrau novo, figurinha rara, desafio da unidade.
Testes: geração e resolução do link, fluxo visitante do desafio, garantia de que o canvas do replay não recebe frames da câmera.
```

---

## Etapa 10 · Medição
**Entrega:** eventos padronizados e painel simples de funil.
**Critério de aceite:** dá para responder em 1 consulta: tempo até a 1ª rep, D1/D7, taxa de repetição por lição, uso de Trocar por motivo, contexto mais usado, desafios abertos → cadastros.

```text
Contexto: Hive Break. Métricas pedidas em PRODUTO_REFERENCIAS_DUOLINGO.md §2.3, 4HC_PRINCIPIOS.md §4 (taxa de repetição como métrica nº 1 por desafio) e critérios do piloto B2B (adesão, sessões em hive, questionário de dor, recomendação, disposição a pagar).

Tarefa:
1. Tabela eventos (usuario_id ou visitante_id, nome, props jsonb, criado_em) com RLS; helper registrarEvento no cliente e no servidor.
2. Padronizar eventos já citados nas etapas 4–9.
3. Views SQL: funil_primeiro_acesso, retencao_d1_d7_d30, repeticao_por_licao (quantos voltam a fazer a mesma lição na semana seguinte), trocas_por_motivo, contexto_por_horario, desafio_aberto_conversao.
4. Página interna /admin/metricas (só para o meu usuário) com essas views em tabelas simples.
Testes: inserção com RLS, cálculo das views com dados de exemplo.
```

---

## Agenda (proposta de 19/11/2026)
- **Individual (primeira sessão e revanche):** link de modelo do Google Agenda + .ics como alternativa (Etapa 4, item 6).
- **Hive agendada da equipe ("Break das 15h"):** depois do cadastro, o n8n envia e-mail de contatohivebreak@gmail.com com convite .ics (METHOD:REQUEST, recorrente, link da sala da hive). No Gmail e no Outlook aparece como convite com Sim/Não e entra na agenda de todos. É o formato que escritório já usa no dia a dia [validar].

## Decisões para o Luan (antes ou durante as etapas)
1. ~~Snack de 1 min avança a trilha ou só mantém a ofensiva?~~ **Decidido (20/11): só mantém a ofensiva** (+ XP pequeno [validar valor]); não avança a trilha.
2. ~~Modo discreto conta para a ofensiva?~~ **Decidido (20/11): sim**, fora da liga e sem XP de câmera.
3. **Faixas da colocação** e da autoprogressão (110% / 60%): validar com alunos do TTC.
4. ~~Garrafão de 10–20 L?~~ **Decidido (20/11): entra só para avançados** (terra e agachamento abraçado; nunca acima da cabeça).
5. ~~Tempo para retomar hive interrompida?~~ **Decidido (20/11): 30 min.**
7. ~~Username depois da primeira hive?~~ **Decidido (20/11): sim**, na tela de resultado junto do card; quem entra por convite numa hive ao vivo informa só um apelido antes.
6. Ordem das etapas 5 a 9 se o piloto B2B começar antes: para escritório, puxar a Etapa 7 para logo depois da 4.

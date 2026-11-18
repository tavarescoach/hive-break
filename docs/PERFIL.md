# Hive Break — Páginas de perfil v2 (próprio, de amigo e público) + busca de amigos

> v2 (18/11/2026, tarde). Substitui a v1 da madrugada. Base: perfis do Duolingo (Freya; Paulo Philippe; o do Luan) comparados com a tela atual de perfil do Hive Break.
> Complementa `SOCIAL_DUOLINGO.md` (2.3 perfil público, 2.5 seguindo por XP), `VISITANTE.md` (regras do username), `CARD_COMPARTILHAMENTO.md` e `LINKEDIN_HIVER.md`.
> Itens **[validar]** são padrão até decisão do Luan.

---

## 0. Diagnóstico da tela atual

A tela de perfil atual é uma **ficha de configurações**: 4 números (ofensiva, recorde, protetores, dificuldade), uma lista de dados (idade, sexo, altura, peso, IMC, objetivo, rotina, dias por semana, meta diária, equipamento, limitações, música, lembrete, triagem) e o botão "Editar".

O perfil do Duolingo é uma **vitrine**: identidade no topo, grade de estatísticas no centro e, à direita, números fixos, feed de amigos com "Celebrar" e a lista seguindo/seguidores.

**Regra da v2:** o perfil mostra **progresso e pessoas**. Os dados de cadastro (idade, sexo, altura, equipamento, limitações, música, lembrete, triagem) saem da página e vão para **/perfil/config**. Na página fica só o que gera orgulho ou ação.

---

## 1. Layout

### 1.1 Computador (≥1024 px): 3 colunas
| Esquerda (fixa) | Centro (até ~600 px) | Direita (~360 px) |
|---|---|---|
| Menu: Trilha, Hive, Liga, Amigos, Perfil, Mais | Capa → identidade → **objetivo** → **meta da semana** → estatísticas → calendário → "Vocês dois" (perfil de amigo) → atividade recente | Barra de números → **vitrine de conquistas** → feed de amigos → seguindo/seguidores + **buscar** |

### 1.2 Celular: uma coluna, nesta ordem
Capa → identidade + ações → objetivo → meta da semana → estatísticas (grade 2×2) → conquistas (vitrine) → calendário → "Vocês dois" → atividade recente → amigos. Menu inferior como hoje.

Regra: uma ação principal por tela, sempre visível (meu perfil: **Compartilhar**; perfil de amigo: **Chamar para uma hive**; perfil público: **Treinar com fulano**).

---

## 2. Blocos do centro

### 2.1 Capa
- Fundo na cor escolhida pelo usuário (paleta da marca), com padrão de hexágonos sutil.
- Avatar grande em hexágono (foto ou avatar). **A moldura muda:** cor da divisão da liga + chama animada se a ofensiva está ativa hoje.
- Anel amarelo pulsando se a pessoa está **em uma hive agora** (tocar = entrar).
- Meu perfil: lápis para editar capa, cor e foto.

### 2.2 Identidade e ações
- Nome, @username, "No Hive Break desde nov/2026", **N seguindo · N seguidores** (clicáveis).
- Selos: divisão da liga, tempo de ofensiva ("30+ dias"), "Mesmo time" (B2B).
- Ações:
  - Meu perfil: **Compartilhar perfil** (principal) · Editar perfil · Convidar amigos.
  - Perfil de amigo: **Chamar para uma hive** (principal, amarelo) · Seguir/Seguindo · menu (bloquear, denunciar).
  - Perfil público: **Treinar com {nome}** (cadastro com convite rastreado, ver `VISITANTE.md`).

### 2.3 Objetivo em destaque (novo)
Card largo logo abaixo da identidade, o primeiro que o olho pega.

```
🎯 GANHAR FORÇA                                  [👁 esconder peso]
80 kg   →   meta 84 kg (+4 kg)
████████████░░░░░░░░  +1,5 kg ganhos desde 02/11
```

- Título: o objetivo principal (Emagrecimento, Ganho de massa, Força, Mobilidade, Condicionamento, Longevidade). Se houver mais de um, mostra o principal e "+1".
- **Linha do peso:** peso atual → meta (com sinal: **+X kg** para ganhar, **−X kg** para perder).
- **Barra de progresso:** "**+1,5 kg ganhos**" ou "**−3 kg perdidos**" desde a data do peso inicial. A cor da barra é amarela quando anda na direção da meta e cinza neutro quando volta (**nunca vermelho, nunca mensagem de culpa**).
- Atualizar o peso: botão "Registrar peso" (no máximo 1 por dia). Lembrete opcional semanal **[validar]**.
- Objetivo sem peso (Mobilidade, Longevidade) ou quem não quer peso: o card mostra o objetivo + a meta de treino da semana, sem a linha de kg.

**Privacidade do peso (regra fixa):**
| Visibilidade | Padrão | O que os outros veem |
|---|---|---|
| Só eu | **Sim** | Nada de peso. Só o título do objetivo |
| Mostrar variação | Não | "+1,5 kg desde nov" e a barra, **sem o peso absoluto nem a meta em kg** |
| Mostrar tudo | Não **[validar se existe]** | Peso atual e meta |

- O botão 👁 no próprio card esconde ou mostra **para mim** (ex.: tela compartilhada no escritório). É separado da visibilidade para os outros, que fica em /perfil/config.
- No **perfil público e no modo empresa**, o peso absoluto nunca aparece, mesmo com "mostrar tudo".
- O card de compartilhamento do perfil nunca mostra o peso absoluto (coerente com `CARD_COMPARTILHAMENTO.md` e a marca: "ninguém é exposto").
- IMC sai da página (fica em /perfil/config, só para o dono).

### 2.4 Meta da semana (novo)
```
META  3 hives por dia · 5 dias na semana
Esta semana   11 de 15 hives      ● ● ● ○ ○  (3 de 5 dias)
🔥 12 dias de hive streak
```
- **Meta:** X hives por dia, Y dias na semana (vem do onboarding; edita aqui com toque longo ou em /perfil/config).
- **Esta semana:** hives feitas / meta da semana (X × Y) e bolinhas dos dias (cheia = meta do dia batida, meia = treinou mas não bateu, vazia = não treinou). A semana começa na segunda (igual à liga).
- **Hive streak:** dias seguidos treinando (a mesma ofensiva do app, nome único na interface **[validar: "ofensiva" ou "hive streak"]**).
- Fechou a semana: o bloco vira "Semana completa ✓" com brilho até domingo e gera evento no feed.
- **Termo:** aqui "hive" = desafio concluído (sozinho ou em grupo). Hoje o app chama a sessão em grupo também de "hive". **[validar]** ou trocar a unidade da meta para "breaks".

### 2.5 Estatísticas (grade 2×2, com números que sobem ao abrir)
| Card | Conteúdo |
|---|---|
| 🔥 Ofensiva | Dias seguidos; chama acesa (amarelo) se treinou hoje, cinza se ainda não. Recorde pequeno embaixo |
| ⚡ XP total | XP total + "N XP esta semana" |
| 🛡 Liga | Divisão com a cor e o degradê, brilho no Diamante, selo "Semana N" |
| 🏅 Pódios | Vezes no top 3 |

Linha extra, menor: minutos ativos (total e semana) · hives em grupo · protetores.
Em perfil de terceiro com "esconder XP" ligado: ficam só ofensiva e conquistas.

### 2.6 Calendário de atividade
- Mês em hexágonos: preenchido nos dias com treino, amarelo forte nos dias em que bateu a meta, contorno nos dias com hive em grupo.
- Setas para meses anteriores. É o elemento mais fácil de entender de longe e o mais bonito para o print.

### 2.7 "Vocês dois" (só no perfil de amigo)
- Gráfico da semana: as hives dele × as suas, dia a dia (o "XP this week: Paulo × You" do Duolingo).
- Hives feitas juntos (total e a última).
- Sem histórico juntos: "Vocês nunca fizeram uma hive juntos" + **Chamar para uma hive**.
- Pós-MVP: ofensiva de amigos e missão em dupla (`SOCIAL_DUOLINGO.md` 2.6 e 2.7).

### 2.8 Atividade recente
Últimos eventos da pessoa (catálogo em `SOCIAL_DUOLINGO.md` 2.1), cada um com high five e contador.

---

## 3. Coluna da direita

### 3.1 Barra de números (fixa no topo)
Objetivo atual (ícone) · 🔥 ofensiva · ⚡ XP da semana · 🛡 divisão. No celular, essa barra é o topo da Trilha.

### 3.2 Vitrine de conquistas (motor de engajamento)
- **3 conquistas em destaque** escolhidas pelo dono, grandes, com o nível (ex.: "Mil reps · nível 3").
- Abaixo: **a próxima conquista mais perto** com barra ("Colmeia: 7/10 hives em grupo"). Isso dá o próximo passo a quem olha o próprio perfil.
- "Ver todas" abre a lista com barras de progresso, separadas em Hábito, Força/Volume, Social, Liga e Mensais.
- No perfil de amigo: conquistas que ele tem e você não ficam com o selo "Você ainda não tem" (desejo de copiar).

### 3.3 Feed de amigos
- Os últimos eventos dos amigos (máx. 1 por pessoa por dia), cada um com **High five** e estado "Você deu high five".
- "Ver tudo" → /amigos/feed.

### 3.4 Seguindo / Seguidores
- Abas Seguindo | Seguidores. Lista ordenada por XP da semana (ranking entre amigos sem tela nova).
- Cada linha: avatar com anel "em hive agora", nome, XP da semana, botão Seguir quando ainda não segue.
- No topo da caixa: **🔍 Buscar amigos** e **Convidar**.
- "Ver mais N" → /amigos.

---

## 4. Buscar, visitar e adicionar amigos (novo)

### 4.1 Modelo
- **Seguir** é de mão única (como no Duolingo): não precisa de aprovação.
- **Amigos** = vocês se seguem. Amigos aparecem no feed, no "Vocês dois", na presença "em hive agora" e podem chamar para uma hive.
- Convite ativado = os dois se seguem automaticamente (regra já decidida).
- Perfil "só amigos": seguir vira **pedido** e precisa ser aceito **[validar]**.
- Bloquear: a pessoa some da sua busca, das listas e do feed, e não consegue te ver nem te seguir.

### 4.2 Tela de busca (/amigos/buscar; no computador, também um modal pela coluna direita)
- Campo único: "Buscar por nome ou @username". Busca a partir de 2 caracteres, com espera de 300 ms entre teclas.
- **Resultado:** avatar, nome, @username, ofensiva, divisão, objetivo (ícone), "N amigos em comum" e o botão **Seguir / Seguindo / Pedido enviado / Seguir de volta**. Tocar na linha abre o perfil.
- **Antes de digitar (sugestões):** "Seguem você e você não segue" · amigos de amigos (por amigos em comum) · mesma empresa (B2B) · quem entrou pelo seu convite.
- **Atalhos:** Convidar pelo WhatsApp · Copiar meu link (`hivebreak.app/@luan`) · QR code do meu perfil (bom para academia e escritório).
- **Busca vazia:** "Ninguém com esse nome por aqui ainda. Treinar é mais fácil com a sua hive." + Convidar pelo WhatsApp.
- Perfil "só amigos" aparece na busca só com nome, @ e avatar. O resto fica fechado até virarem amigos.

### 4.3 Visitar perfil
- Rota única: `/@username`. Logado: perfil de amigo ou de terceiro. Sem login: perfil público (botão "Treinar com {nome}").
- Ao seguir: o botão vira "Seguindo" na hora (atualização otimista) e quem foi seguido recebe "{nome} começou a te seguir" + **Seguir de volta** (push e no app, nunca e-mail separado; entra no resumo).

---

## 5. Compartilhar o perfil
- Botão **Compartilhar perfil** → folha nativa (Web Share API): link, WhatsApp, Instagram.
- **Card do perfil (9:16 e 4:5):** avatar, @username, objetivo, ofensiva, meta da semana (ex.: "11/15 hives"), divisão e as 3 conquistas da vitrine, com o link ou QR no rodapé. Variação de peso só se a pessoa ligar "mostrar variação" **e** marcar no card **[validar]**. Peso absoluto nunca.
- Pré-visualização do link (Open Graph): imagem gerada com nome, ofensiva e divisão.
- Botão LinkedIn quando existir a credencial (`LINKEDIN_HIVER.md`).

---

## 6. Variações
| | Meu perfil | Perfil de amigo | Perfil público (sem login) |
|---|---|---|---|
| Ação principal | Compartilhar perfil | Chamar para uma hive | Treinar com {nome} |
| Objetivo | Sim, com peso conforme o 👁 | Título + variação se permitido | Só o título |
| Meta da semana | Sim | Sim | Sim **[validar]** |
| Estatísticas | Sim | Sim (sem XP se escondido) | Ofensiva, liga, conquistas |
| "Vocês dois" | Não | Sim | Não |
| Vitrine + próxima conquista | Sim, editável | Sim, com "Você ainda não tem" | Só vitrine |
| Feed / seguindo | Sim | Amigos dele, com Seguir | Não |
| Editar capa, cor, vitrine | Sim | Não | Não |

---

## 7. Privacidade (em /perfil/config → Privacidade)
- Perfil visível para: todos (padrão no modo consumidor) / só amigos (padrão no modo empresa) / só equipe **[validar]**.
- Peso para os outros: só eu (padrão) / mostrar variação / mostrar tudo.
- Esconder XP e liga dos outros.
- Aparecer na busca (padrão: sim).
- O perfil público nunca mostra dados de empresa, de saúde (triagem, limitações), idade, sexo, altura ou IMC.

---

## 8. Checklist de design
- Fundo escuro da marca; amarelo #FFC42E só onde há ação, conquista ou meta batida.
- Hexágono como forma recorrente (avatar, calendário, conquistas, bolinhas da meta).
- Números grandes com ícone colorido; animação de subir uma vez ao abrir.
- Cada divisão com sua cor e degradê; Diamante com brilho.
- Estados vivos: chama acesa ou apagada, anel "em hive agora", "semana completa".
- Peso nunca em vermelho; variação contrária à meta em cinza, sem texto de culpa.

---

## 9. Dados (Supabase; tabela `profiles` de `VISITANTE.md`)
- `profiles`: `username`, `cor_capa`, `foto_url`, `vitrine_conquistas` (até 3 ids), `visibilidade_perfil` (todos | amigos | equipe), `visibilidade_peso` (eu | variacao | tudo), `esconder_xp` (bool), `aparecer_na_busca` (bool), `objetivo_principal`, `objetivos[]`, `peso_inicial_kg`, `peso_inicial_em`, `peso_meta_kg`, `meta_hives_dia`, `meta_dias_semana`, `criado_em`.
- `pesagens`: `usuario_id`, `peso_kg`, `registrado_em` (único por usuário/dia). Peso atual = último registro.
- `seguidores`: `seguidor_id`, `seguido_id`, `status` (ativo | pendente), `criado_em` (único por par). Amigos = par nos dois sentidos.
- `bloqueios`: `usuario_id`, `bloqueado_id`, `criado_em`.
- RLS: peso e pesagens só legíveis pelo dono; uma view `perfil_publico_v` devolve a variação calculada (sem kg absoluto) quando `visibilidade_peso = 'variacao'`.
- Busca: índice trigram (`pg_trgm`) em `username` e `nome`; função `buscar_usuarios(q)` que exclui bloqueios e `aparecer_na_busca = false`; limite de 20 resultados e limite de chamadas por minuto.
- Consultas: hives por dia na semana (dono e amigo); dias com meta batida; hives em comum (`hive_participantes`); amigos em comum; próxima conquista mais perto.
- Eventos: `profile_viewed`, `profile_shared`, `user_search`, `follow`, `follow_back`, `weight_logged`, `weekly_goal_completed`.

## 10. Métricas
- Visitas a perfis de terceiros por usuário/semana e % que vira Seguir.
- % de seguidos que seguem de volta em 48 h.
- Compartilhamentos de perfil → cadastros pelo link.
- % de usuários com vitrine personalizada e com peso/meta preenchidos.
- Semanas completas / semanas ativas.

## 11. Decisões em aberto (Luan)
1. Unidade da meta: "hives" (e chamar a sessão em grupo de outra coisa) ou "breaks"?
2. Nome único na interface: "ofensiva" ou "hive streak"?
3. Existe "mostrar tudo" para o peso ou só "variação"?
4. Perfil "só amigos" exige aprovação para seguir?
5. Meta da semana aparece no perfil público?

## 12. Ordem de implementação sugerida
1. Rota `/@username` + layout de 3 colunas / 1 coluna, mover a ficha de dados para /perfil/config.
2. Objetivo com peso (+ `pesagens`, privacidade e 👁) e meta da semana.
3. Grade de estatísticas + calendário.
4. Busca + seguir/seguir de volta + bloquear.
5. Coluna direita: vitrine + próxima conquista, feed com high five, seguindo/seguidores.
6. "Vocês dois", compartilhar perfil (card + Open Graph).

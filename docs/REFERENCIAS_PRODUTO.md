# Hive Break — Referências de produto (padrões do Duolingo)

> Documento de orientação para o desenvolvimento, enviado pelo Luan em 17/11/2026. O Duolingo é **referência de padrões de UX e de engajamento**, não de visual.
> Não copiar nomes, personagens, ilustrações, cores ou textos do Duolingo. Manter a identidade do Hive Break (fundo escuro, amarelo #FFC42E, colmeia/hexágono).

---

## 1. Mapa Duolingo → Hive Break

| Duolingo | Hive Break | Observações |
|---|---|---|
| Curso (idioma) | **Objetivo** (programa de treino) | Emagrecimento, Ganho de massa muscular, Força, Mobilidade, Condicionamento, Longevidade. O usuário pode ter mais de um objetivo e troca pelo seletor no topo (como a bandeira do curso). Cada objetivo tem trilha, progresso e XP próprios. |
| Learn | **Trilha** | Objetivo → Seção → Unidade → 8 a 12 desafios. Banner fixo "SEÇÃO X · UNIDADE Y + nome da unidade". |
| Guidebook | **Guia da unidade** | Botão no banner: o que a unidade treina, músculos, método usado, dicas de execução. |
| Lição (círculo no caminho) | **Desafio** (hexágono no caminho) | Até 5 min. Estados: concluído, atual (com "COMEÇAR"), bloqueado. Baú de XP a cada ~4 desafios. Desafio da unidade no fim. |
| Practice | **Treino livre** | Ver seção 5. |
| Leaderboards | **Liga** | Ver seção 4. |
| Quests | **Missões** | Diárias, por turno e mensais. Ver seção 4. |
| Profile | **Perfil** | Estatísticas, conquistas, seguindo/seguidores, avatar. |
| Modal de streak | **Ofensiva** | Calendário do mês, meta de ofensiva (marcos), congelamento de ofensiva, aba "Amigos" com ofensivas dos amigos e botão **Cutucar**. |
| Feed de amigos + "Celebrate" | **Feed da Colmeia + High five** | "Luan completou Sessão 2 · Emagrecimento · 5 min" → botão High five, com contador. |
| Find friends / Invite friends | **Amigos** | Buscar por nome/usuário + convite por link (copiar, **WhatsApp**, Instagram). WhatsApp é o canal principal no Brasil. |
| Family Plan | (pós-MVP) **Plano Colmeia / Empresa** | Assinatura para grupo/time. |

---

## 2. Crescimento: o loop social é a prioridade do produto

O fator de crescimento da startup é **usuários convidando amigos**. Toda tela deve ter um caminho para o social.

### 2.1 Convidar amigos
- Botão "Convidar amigos" presente em: Amigos, Perfil, tela de resultado de desafio e tela vazia de Liga/Feed.
- Link de convite único por usuário (rastrear quem convidou quem).
- Compartilhar: copiar link, WhatsApp (texto pronto), Instagram Stories (card de imagem).
- Recompensa para os dois lados quando o convidado conclui o primeiro desafio (ex.: XP bônus ou congelamento de ofensiva).

### 2.2 Hive Break em grupo (diferencial do produto)
Fluxo:
1. Usuário toca **"Começar uma Hive"** e escolhe um desafio.
2. Amigos conectados recebem notificação ("Luan começou uma Hive Break de 5 min. Entrar?"). Não usuários entram por link.
3. Sala de espera curta (ex.: 60 s) mostrando quem entrou.
4. Todos fazem o desafio ao mesmo tempo.
5. **Card de resultado coletivo**: cada participante com tempo, reps, XP. Bônus de XP por fazer em grupo.
6. Resultado vai para o Feed da Colmeia com **High five** e opção de compartilhar no WhatsApp.

Notas técnicas:
- Tempo real via Supabase Realtime (sala, presença, resultados).
- Notificação: Web Push (no iPhone só funciona com o app instalado na tela inicial como PWA, iOS 16.4+). Fallback por e-mail.
- MVP possível: Hive **por link** (o anfitrião manda o link no WhatsApp), antes de push.

### 2.3 Métricas a registrar desde o início
- Convites enviados por usuário ativo; % de convites que viram cadastro; % que concluem o 1º desafio (K-factor).
- Hives criadas, participantes por Hive, High fives por usuário.
- Retenção D1/D7/D30 e tamanho médio da ofensiva.

---

## 3. Perfil e estatísticas

- **Ofensiva** (dias consecutivos) — principal métrica de hábito.
- **XP total**.
- **Minutos ativos** (total e na semana).
- **Liga atual** e semanas na liga.
- **Pódios** (vezes no top 3 da liga).
- **Conquistas** com níveis e barra de progresso. Exemplos: "Chama acesa" (ofensiva de 7/30/100/365 dias), "Mil reps", "Colmeia" (fez X Hives em grupo), "Recrutador" (convidou X amigos que treinaram), "Madrugador" (X missões da manhã).
- Seguindo / seguidores e avatar personalizável (pós-MVP).

---

## 4. Liga e missões

### 4.1 Liga semanal
Revisada e implementada em 17/11/2026: regras na seção 9.3 de `ESPECIFICACAO.md`
(entrada no 1º desafio com câmera da semana, pontos = XP de desafios com câmera,
sobe e desce proporcional ao tamanho do grupo, ninguém exposto na tela).

### 4.2 Missões
- **Diárias (3 por dia)**: ex. "Ganhe 30 XP", "Faça 10 min de atividade", "Complete 2 desafios com nota boa".
- **Por turno**: ex. "30 agachamentos de manhã" + "30 agachamentos à noite".
- **Meta OMS**: referência de 150–300 min/semana de atividade moderada (≈30 min em 5 dias) como missão semanal.
- **Mensais temáticas com badge exclusiva**: ex. Novembro Azul (saúde do homem), Outubro Rosa, Setembro Amarelo... "Complete 35 missões em novembro".
- Cada missão concluída abre um baú (XP ou congelamento de ofensiva).

---

## 5. Treino livre (equivalente ao Practice)

- **Treino-alvo do dia**: sessão personalizada para pontos fracos (grupos/movimentos menos treinados ou com pior nota).
- **Coleções por região**: abdômen/CORE, membros inferiores, membros superiores, bíceps, glúteos, mobilidade, alongamento.
- **Coleções por material**: só peso do corpo, elástico, halter, kettlebell (com aviso prévio de equipamento).
- **Refazer**: desafios já concluídos com nota baixa.
- Treino livre também dá XP e conta para a ofensiva.

---

## 6. Métodos de treino dos desafios (em discussão)

Variáveis metodológicas de cada desafio: seleção do exercício, séries, repetições ou tempo, cadência/tempo sob tensão, intervalo, densidade (trabalho por minuto), carga/equipamento.

### 6.1 Formatos que cabem em até 5 minutos

| Método | Estrutura | Como a câmera valida | Score |
|---|---|---|---|
| Repetições | ex. 3 × 10 agachamentos | conta reps válidas | reps válidas / alvo |
| Isometria | ex. prancha 30–45 s | posição mantida | tempo na posição |
| Intervalado | 30 s on / 30 s off, ou 40/20 | tempo + reps no bloco | reps por bloco |
| Tabata | 20 s on / 10 s off × 8 = 4 min | reps por round | soma e menor round |
| EMOM | X reps no início de cada minuto, 5 min | reps dentro do minuto | minutos cumpridos |
| AMRAP | máximo de reps/rounds em X min | conta reps | total (ótimo para Liga) |
| Escada / pirâmide | 1-2-3-4-5 reps... | conta reps | degraus concluídos |
| Cadência controlada | ex. 3 s descendo, 1 s parado, 1 s subindo | mede tempo da fase | nota de qualidade |
| Respiração / volta à calma | ciclos guiados | sem validação (timer) | conclusão |

"Super Tabata" e outras variações: estrutura a definir pelo Luan.

### 6.2 Ênfase de métodos por objetivo (proposta inicial)
- **Emagrecimento**: densidade alta — Tabata, intervalado, AMRAP, circuitos.
- **Ganho de massa muscular**: repetições com cadência controlada, EMOM, séries perto da falha; progressão de volume.
- **Força**: menos reps, mais controle, isometrias, progressões de dificuldade do movimento (ex. flexão inclinada → flexão → flexão declinada).
- **Longevidade**: mobilidade, equilíbrio, força funcional, isometria, respiração.
- **Condicionamento**: intervalado, Tabata, EMOM.

### 6.3 Progressão ao longo da trilha
Dentro de um objetivo, a dificuldade sobe nesta ordem: volume (mais reps/tempo) → densidade (menos descanso) → complexidade do movimento → carga (equipamento entra com aviso).

### 6.4 Modelo de dados sugerido para um desafio
```
desafio {
  id, objetivo, secao, unidade, ordem,
  nome, duracao_seg, xp,
  metodo: "reps" | "isometria" | "intervalado" | "tabata" | "emom" | "amrap" | "escada" | "cadencia" | "respiracao",
  blocos: [{ exercicio_id, trabalho_seg?, descanso_seg?, reps_alvo?, cadencia? (ex. "3-1-1"), rounds? }],
  equipamento: [], regiao: [], guia_execucao
}
```
Com isso o mesmo motor de timer/validação roda todos os métodos — só muda a configuração.

---

## 7. Decisões em aberto (Luan)
1. Lista final de objetivos e quantas seções cada um terá no MVP.
2. Tabela de XP por método e duração.
3. Estrutura do "Super Tabata" e outros métodos próprios.
4. Nomes das divisões da Liga.
5. Recompensa do convite (o que ganha quem convida e quem é convidado).
6. Hive Break no MVP: por link (mais simples) ou com notificação push.

---

## 8. Ordem de implementação sugerida
1. **Objetivo como curso + Trilha jogável**: seletor de objetivo, Seção/Unidade/Desafios, desafio com timer (sem câmera ainda), XP e ofensiva salvos no Supabase.
2. **Perfil e Ofensiva**: estatísticas, modal de ofensiva com calendário e meta, missões diárias.
3. **Social básico**: buscar/seguir, convite por link e WhatsApp com rastreio, Feed da Colmeia com High five, Cutucar.
4. **Hive Break em grupo**: sala em tempo real, card de resultado coletivo.
5. **Liga semanal, missões mensais com badges, Treino livre.**
6. **Validação por câmera** plugada no motor de métodos.

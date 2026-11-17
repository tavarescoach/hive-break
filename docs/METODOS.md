# Hive Break — Métodos dos desafios

Definido em 17 e 18/11/2026, a partir das diretrizes do Luan. Objetivo: todo desafio é
descrito por **dados** (método + parâmetros), e um único motor de linha do tempo roda
qualquer método. A câmera conta e mede dentro de cada fase.

## 1. Modelo comum

Um desafio é uma sequência de **blocos**. Cada bloco tem um exercício, um método e os
parâmetros do método. O método vira uma **linha do tempo de fases**:

| Fase | Cor na tela | O que acontece |
| --- | --- | --- |
| Preparação | branco | 5 s para posicionar, com o gabarito da posição |
| Trabalho | amarelo-mel (ou verde) | câmera conta reps ou tempo na posição |
| Descanso | cinza | contagem regressiva grande, prévia da próxima série, resumo da anterior |
| Transição | branco | troca de exercício: nome, gabarito, "de frente" ou "de lado" |

Regras gerais:

- **Até 5 minutos por desafio**, somando trabalho e descanso. O gerador de conteúdo
  recusa combinações que passem disso.
- Últimos 3 s de cada fase: bipe e número piscando. Troca de fase: som diferente e
  vibração.
- O botão do topo passa a ser **"Próximo"** (pula para o próximo exercício). Só no último
  exercício ele vira "Concluir".
- Toda fase de trabalho tem **meta** (o que é preciso para cumprir) e **medida** (o que
  conta para o score).

## 2. Métodos

### 2.1 Intervalado por tempo (proposto pelo Luan)
- Trabalho de 10, 20, 30, 40 ou 45 s; descanso de 10, 20 ou 30 s; 2 a 5 séries.
- Meta da fase, uma de três:
  - **AMRAP**: o máximo de repetições válidas;
  - **faixa**: mínimo e máximo de reps (ex.: 8 a 12 em 30 s), para controlar o ritmo;
  - **sustentar**: isometria durante o tempo de trabalho (prancha, posturas).
- Score: reps totais em relação à meta, e queda entre a primeira e a última série (fadiga).

### 2.2 Tabata (proposto pelo Luan)
- Protocolo fixo: 8 rounds de 20 s de trabalho e 10 s de descanso = 4 min.
- Um ou dois exercícios alternados (ex.: rounds ímpares agachamento, pares polichinelo).
- Score clássico: **soma** dos rounds e **pior round** (o menor), que mostra a
  constância.

### 2.3 Séries e repetições (proposto pelo Luan)
- 2 a 5 séries de 6, 8, 10, 12 ou 15 reps; intervalo de 30, 45 ou 60 s.
- A série termina quando a câmera conta a última rep; o descanso começa sozinho.
- Contador "8/12" e "2ª série de 3", como na seção 8.5 da especificação.
- Score: reps válidas / meta, amplitude e técnica.

### 2.4 Propostas novas

| Método | Estrutura | Por que vale a pena | Score |
| --- | --- | --- | --- |
| **EMOM** | a cada minuto, X reps; o que sobra do minuto é descanso; 3 a 5 min | ensina ritmo; quem é rápido descansa mais | minutos cumpridos |
| **Circuito** | 2 a 4 exercícios em sequência, sem pausa entre eles; descanso entre rodadas; 2 a 4 rodadas | resolve o "desafio de 2 exercícios" de forma natural; bom para emagrecimento | reps por rodada |
| **Cadência controlada** | ex.: 3 s descendo, 1 s parado, 1 s subindo; 2 a 3 séries de 5 a 8 reps | foco em técnica e hipertrofia; a câmera já mede descida e subida | % de reps no tempo certo |
| **Escada** | 2-4-6-8-10 reps (ou 10-8-6-4-2), sem pausa, até o teto de tempo | motivador: cada degrau é uma pequena vitória | degraus concluídos |
| **Contra o relógio** | X reps no menor tempo, com teto | ótimo para liga e recorde pessoal | tempo para concluir |
| **Isometria em séries** | 2 a 3 × 20 a 45 s com descanso | prancha, árvore, guerreiro: com gabarito na tela | tempo válido / meta |
| **Respiração guiada** | ciclos 4-6 (inspira-expira) ou caixa 4-4-4-4 | volta à calma | % do tempo parado |

## 3. Qual método em cada posição da unidade (proposta)

| Posição (seção 6.2) | Método padrão | Exemplo |
| --- | --- | --- |
| Aquecimento | intervalado 30/10, faixa leve | marcha e polichinelo, 3 séries |
| Mobilidade | séries e reps com cadência lenta | elevação em Y, 2 × 8, 3-0-3 |
| Equilíbrio | isometria em séries | apoio em uma perna, 2 × 30 s por lado |
| Precisão | intervalado 30/15 | toque nos alvos, 3 séries |
| Força | séries e repetições | agachamento, 3 × 10, 45 s |
| CORE | isometria em séries ou EMOM | prancha 3 × 30 s |
| Condicionamento | circuito ou intervalado AMRAP | skipping + polichinelo, 3 rodadas |
| HIIT | Tabata | 8 × 20/10 |
| Yoga | isometria com gabarito | guerreiro II 2 × 30 s por lado |
| Volta à calma | respiração guiada | 4-6 por 3 min |
| Desafio da unidade | circuito ou contra o relógio | 3 exercícios da unidade |

A progressão segue o documento de referências: volume → densidade → complexidade →
carga. Em números: mais reps ou segundos, depois menos descanso, depois variação mais
difícil do exercício, depois equipamento.

## 4. Mudanças de tela (pedidas no teste)

- **Timer grande**: em fase de trabalho, contador e tempo ocupam a metade de cima da
  tela, legíveis a 3 m; em descanso, a tela toda fica cinza com a contagem regressiva
  enorme.
- **Gabarito da posição**: figura de palito da posição esperada, em transparência sobre a
  câmera nas isometrias e posturas, e animada (ida e volta) nos exercícios de repetição,
  na tela de preparação.
- **"Concluí" não encerra mais o desafio**: passa para o próximo exercício.

## 5. Decisões do Luan (18/11/2026)

1. **Métodos no MVP:** intervalado por tempo (AMRAP, faixa de reps ou sustentar), Tabata,
   séries e repetições, circuito, EMOM, escada e contra o relógio. Cadência controlada
   fica para depois.
2. **Cor do trabalho:** amarelo-mel. Descanso em cinza; preparo e transição em branco.
3. **Séries e repetições sem teto:** a série espera a pessoa completar as reps (ou tocar em
   "Pular").
4. **Limite de 5 min inclui os descansos.** Como a série espera a pessoa, o limite vale para
   a duração **planejada**, calculada com um ritmo de referência por exercício
   (`seg_por_rep` em cada JSON de exercício). Quem for mais devagar pode passar um pouco.

## 6. Onde está no código

- `src/dominio/metodos.ts`: tipos dos métodos, `montarLinhaDoTempo` (método → fases),
  `SessaoTreino` (percorre as fases) e `resumirMetodo` (resultado por método).
- `src/exercicios/gabaritos.ts` e `src/componentes/Gabarito.tsx`: figuras das posições.
- `src/app/desafio/[id]/Execucao.tsx`: a tela, com ou sem câmera.
- `scripts/gerar-seed-trilha.ts`: escolhe o método de cada desafio da trilha.

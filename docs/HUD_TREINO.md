# Hive Break — HUD da tela de treino (câmera + contagem)

Nov 18, 2026 · @Luan Tavares

> Reformulação da tela de execução (`/desafio/[id]/jogar`, componente `Execucao.tsx`). Substitui a seção 8.5 da `ESPECIFICACAO.md` nesse ponto específico: a tela de execução.

## 1. Problema a resolver

No modo por tempo (AMRAP / intervalo), o tempo restante ("0:05") e as repetições ("37") aparecem lado a lado, do mesmo tamanho, na mesma linha — e são lidos como um número só ("0:0537"). Os painéis de dado também cobrem boa parte da câmera, que é o que a pessoa mais precisa ver (o próprio corpo e o esqueleto de correção).

**Regra principal da reformulação:** nunca dois números grandes lado a lado. Cada dado tem forma, cor e posição próprias — tamanho, cor e lugar na tela identificam o que é o número antes mesmo de lê-lo.

## 2. Câmera

- Vídeo em **tela cheia**, `object-fit: cover` (hoje é `object-contain`; a imagem vai cortar nas bordas em vez de deixar barras).
- Esqueleto: linhas em **amarelo #FFB81C**, pontos em **branco**. (Hoje: `#FFC42E` / branco — ajustar o tom do amarelo.)
- Nenhum painel opaco sobre a câmera. No lugar, um **degradê azul-noite `#0E1726`** só no topo (para os controles) e só na base (para o HUD principal), sempre atrás do texto — nunca um retângulo sólido.
- Fontes:
  - **Inter 900** (Black) para todo número do HUD, sempre com `font-variant-numeric: tabular-nums`.
  - **Rubik** para rótulos, títulos e avisos de texto (ex.: "REPETIÇÕES", correção de técnica).

## 3. Regra principal: um número grande por vez

Só o hero fica grande. O outro dado (quando existe) vira secundário, em forma e posição diferentes — nunca ao lado do hero, no mesmo tamanho.

**Decisão de implementação (18/11/2026):** o hero não é um campo fixo no JSON do exercício — é decidido pela **fase/bloco** que está em curso (`FaseTrabalho` em `src/dominio/metodos.ts`), porque o mesmo exercício pode entrar num bloco de repetições num desafio e num bloco por tempo (AMRAP) em outro. A regra:

- `fase.duracaoMs === undefined` (métodos `reps`, escada, contra o relógio) → **hero = "reps"**.
- `fase.duracaoMs !== undefined` (AMRAP, isometria, Tabata, EMOM) → **hero = "tempo"**.

### 3.1 `hero = "reps"`

- Número de **180px**, cor **amarelo #FFB81C**, centrado embaixo da tela.
- Ao lado, em menor (±60px), "**/12**" em **branco a 60% de opacidade**.
- Abaixo do número, rótulo **REPETIÇÕES** (Rubik, uppercase, tracking largo).
- Abaixo do rótulo, uma **barra SEGMENTADA**: um segmento por rep da meta (1 segmento = 1 rep). Segmentos completados em amarelo, restantes em branco 20%.

### 3.2 `hero = "tempo"` (AMRAP / intervalo)

- Tempo **regressivo** de **130–150px**, cor **branco**, centrado embaixo da tela.
- Rótulo **RESTAM** (Rubik, uppercase) abaixo do tempo.
- Abaixo do rótulo, uma barra **CONTÍNUA** que cresce (enche) até o fim do tempo da fase.
- **Últimos 5 segundos:** tempo e barra mudam para **coral #FF5A4E** (alerta visual de reta final, reforçado por áudio — ver seção 7).

### 3.3 Reps secundárias (quando a fase é por tempo mas ainda conta reps)

- Número dentro de um **hexágono amarelo** (`clip-path` *pointy-top*, vértice para cima/baixo) no **canto superior direito** da câmera.
- Número em **#0E1726** (azul-noite, não preto), rótulo **REPS** (Rubik, pequeno) abaixo ou dentro do hexágono.
- Nunca cresce para competir com o hero — tamanho fixo, bem menor que os 130px+ do hero.

## 4. Dois estilos de progresso

Config de perfil `estiloProgresso`, com padrão **`"barra"`**. Seletor nas configurações do perfil (`/perfil/config`).

### 4.1 `"barra"` (padrão)

- Número do hero centralizado, barra (segmentada ou contínua, conforme a seção 3) imediatamente abaixo dele.

### 4.2 `"moldura"`

- A **borda inteira da tela** vira a barra de progresso: um `<rect>` SVG acompanhando o contorno da tela, `rx` de 46px (cantos arredondados), traço de 10px.
  - Segmentada (um trecho do contorno por rep) quando `hero = "reps"`.
  - Contínua (preenche o perímetro) quando `hero = "tempo"`.
- Número do hero desce para o **canto inferior esquerdo**.
- Hexágono de reps secundárias (quando houver) fica no **canto inferior direito** (em vez do canto superior direito do estilo "barra" — a moldura já ocupa as bordas, então os números migram para dentro, embaixo).

## 5. O que fica escondido durante a série

Amplitude, ritmo (cadência) e técnica (os KPIs ao vivo de hoje) **não aparecem durante o esforço**. Eles só aparecem:

1. No **descanso** entre séries (seção 8).
2. No **resumo** do bloco/desafio (tela de resultado).

Only o hero, a reps secundárias (quando houver) e os avisos (correção de técnica, "não estou te vendo") ficam visíveis durante a série.

## 6. Correção de técnica

Quando o motor detecta um erro de execução:

- Aviso **coral `#FF5A4E`**, texto em **`#0E1726`**, **Rubik 800, 30px**, centrado na tela, por **1,5 segundo**.
- O **segmento do esqueleto correspondente ao erro** fica coral (não o esqueleto inteiro — só a articulação/segmento errado; hoje o motor já marca "erro ativo" de forma geral, precisa granularidade por segmento).
- Se o erro invalidou a rep (rep parcial, não contou), o **segmento daquela rep na barra de progresso** aparece em coral (em vez de amarelo/branco), para o usuário ver que ali ele "perdeu" uma rep.

## 7. Controles

### 7.1 Topo (sempre visível, tamanho pequeno)

- **X** para sair (abre confirmação de encerrar).
- **Nome do exercício + série/round** (ex.: "Agachamento · Série 2 de 3").
- **"Pular"** — área de toque de **44px** mínimo (alvo de toque, pode ser visualmente menor).

### 7.2 Sempre visível, embaixo

- **"Senti dor"** — pequeno, canto inferior, sempre visível (não exige abrir o overlay).

### 7.3 Overlay (um toque na tela)

Um toque em qualquer ponto da câmera (fora dos botões do topo/rodapé) abre um overlay:

- Fundo **azul-noite `#0E1726` a 78% de opacidade**.
- **Pausar**: círculo amarelo de **120px**, centro do overlay.
- **"Pular exercício"** e **"Senti dor"**: botões de **64px**.
- Botão de **voz liga/desliga** (mute do feedback falado).
- **"Sair do treino"**.
- Fecha automaticamente depois de **4 segundos de inatividade**, ou com um toque fora dos botões (toque nos botões aciona a ação deles, não só fecha o overlay).

## 8. Descanso entre séries

Tela de descanso, fundo **`#0E1726`** (sólido, sem câmera atrás):

- Tempo regressivo **grande** + barra contínua (mesma lógica da seção 3.2).
- **Cards de amplitude / ritmo / técnica** da série que acabou (os KPIs escondidos durante o esforço aparecem aqui).
- **Dica de correção** da série anterior, se houve erro recorrente (texto curto, ex.: "Desça mais nos agachamentos").
- **"A seguir"**: nome e prévia do próximo exercício/série.
- Botão **"Já tô pronto"** para pular o resto da contagem e começar antes.

## 9. Áudio (reaproveita o que já existe em `src/camera/som.ts` e `src/camera/voz.ts`)

- **Contagem falada** a cada rep válida (voz, `falar()`).
- **Bipe 3-2-1** no início de cada fase de trabalho (`som.tique()` já existe para contagem; reaproveitar/estender para a largada).
- **"Faltam 10"** e **"faltam 5"** falados, só no modo tempo (`hero = "tempo"`), nos segundos 10 e 5 restantes da fase.
- **Aviso de técnica falado** junto com o aviso visual coral da seção 6 (reaproveita `avisar()` / `falar()` já existente em `Execucao.tsx`).
- **Som diferente para rep inválida** (parcial): já existe `som.parcial()`, distinto de `som.valida()` — manter a distinção.

## 10. Impacto em dados e config (implementado em 18/11/2026)

- **Hero por fase, não por exercício** (seção 3): calculado em `Execucao.tsx` a partir de `FaseTrabalho.duracaoMs`, sem campo novo no JSON do exercício. O hexágono de reps secundárias aparece quando o hero é "tempo" e a fase não é de sustentação (isometria/postura/equilíbrio/respiração não contam reps).
- **Perfil** (`src/dominio/perfil.ts`, tabela `profiles`): `estilo_progresso: "barra" | "moldura"`, default `"barra"` (migração `20261121000300_perfil_estilo_progresso.sql`). Seletor em `/perfil/config`, salvo em `salvarConfiguracoes` e levado até `Execucao` via `carregarDesafio` → `Desafio`.
- **Esqueleto por segmento com erro:** `DefinicaoErro` (`src/motor/tipos.ts`) ganhou o campo opcional `pontos?: string[]`. O motor expõe `EstadoMotor.segmentoErro: number[]` — a união dos pontos dos erros "durante" ativos, só quando **todos** têm `pontos` definido; senão fica vazio e `desenharEsqueleto` cai no esqueleto inteiro coral (compatível com erros sem segmento mapeado). Preenchido nos 9 erros "durante" mais relevantes do catálogo (valgo, quadril caído, cotovelo dobrado etc.); erros `fim_rep` (avaliados só ao fechar a rep, ex. `amplitude_curta`) não entram no esqueleto ao vivo.
- **Cores:** esqueleto `#FFB81C` (antes `#FFC42E`), erro `#FF5A4E` (coral, antes `#FF4D4D`).
- **Fontes:** Inter 900 (`--font-inter`) e Rubik (`--font-rubik`) carregadas em `layout.tsx` via `next/font/google`; classes utilitárias `.fonte-numero` e `.fonte-rotulo` em `globals.css`. O resto do app continua na fonte do sistema — só o HUD de treino usa Inter/Rubik.
- **Áudio:** "faltam 10"/"faltam 5" falados uma vez por fase, quando o hero é "tempo" (`sessao.restanteMs` cruzando 10 000/5 000 ms). O bipe 3‑2‑1 já existia via `SessaoTreino.tick` (evento `contagem`) e não precisou de mudança. Voz pode ser silenciada pelo botão do overlay (`vozDesligadaRef`), sem alterar `src/camera/voz.ts`.

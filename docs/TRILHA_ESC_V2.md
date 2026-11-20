# Hive Break · Modo Escritório v2 (revisão ponta a ponta)

> 20/11/2026 · Sigla **ESC** · Feita com o `PROMPT_EXPERIENCIA_PONTA_A_PONTA.md` (checklist C1–C14) sobre `TRILHAS.md` §1, `TRILHAS_ACESSORIAS.md` (Hive Office), `REPERTORIO_TRILHAS.md` §4.1, `ABS_EXERCICIOS.md`, `GLU_EXERCICIOS.md`, `CIENCIA_BREAKS.md` e o código atual (repositório, 20/11).
> Tudo que é escolha nossa leva **[validar]**. Revisão do Luan como treinador antes de ir para o código.

---

## 0. Onde estamos (código em 20/11)
- **Não existe trilha Modo Escritório no app.** A trilha principal é genérica (8 níveis: "Acordando o corpo", "Pernas firmes"…).
- **Hive Office** (acessória, 6 hives) existe, mas foi montada com os exercícios que o motor tinha: elevação em Y, apoio numa perna, árvore, marcha, alongamento de posterior, respiração. **Nenhum exercício de pescoço, ombro ou punho**, que são a promessa do Office ("menos dor cervical e lombar") e a evidência mais forte que temos para escritório (Andersen 2011: 2 min/dia de elevação lateral com elástico reduziram dor de pescoço e ombro).
- O motor tem **24 exercícios**; destes, **13 servem ao Office** (sem chão, sem salto). Faltam os de pescoço, escápula, punho, panturrilha, remada e flexão na mesa.

**Conclusão:** a revisão vira desenho. Este doc define a trilha, as lições e a lista exata do que construir (o que importar da biblioteca na 1C e o que é exercício novo, com regra de câmera a especificar).

---

## 1. Decisões de desenho (as que mudam a experiência)

1. **"Meio corpo" é o grande destravador do Office.** Pescoço, ombro, escápula e punho só precisam de nariz, orelhas, ombros, cotovelos e punhos. Com `pontos_obrigatorios` só de cima, a pessoa faz **sentada na própria cadeira, com o celular encostado no monitor**, a ~1 m. Sem levantar, sem afastar a mesa, sem chamar atenção. Cada lição declara um **enquadramento**: `meio_corpo` (sentado) ou `corpo_inteiro` (em pé, celular a ~2 m). **Nunca os dois na mesma lição** (C4).
2. **Lição de 3 min, não 5.** No escritório o break real é curto. Molde: **3 blocos** (postura · força leve em pé ou sentado · respiração/mobilidade de saída) com pausas de 15 s → **2:50–3:10**. Versão de 5 min = +1 série nos blocos 1 e 2. Snack de 1 min = só o bloco 1 (mantém a ofensiva, não avança a trilha: decisão de 20/11).
3. **Seções por progressão, não por região.** O `TRILHAS.md` tinha S1 = pescoço, S2 = coluna… Isso faz a pessoa passar semanas sem trabalhar uma região e não tem sobrecarga (C1). Agora **toda lição cobre região de cima + região de baixo**, e a **seção sobe a dose** (volume → cadência/pausa → unilateral/carga improvisada → densidade).
4. **PSE ≤ 4 sempre** (regra do validador para o contexto Mesa). A dificuldade sobe por **controle, amplitude e tempo sob tensão**, não por cansaço. Ninguém volta suado para a reunião.
5. **Método dinâmico sem suor:** na Seção 1 o padrão é **AMRAP controlado** (máximo de reps limpas em 40 s com cadência guiada pelo áudio) e **isometria curta** (3 × 15–20 s). Nada de "3 × 10 com 60 s de pausa".
6. **Hive Office vira o "kit de resets"** da trilha: os mesmos exercícios em hives de 1–3 min por momento do dia (pós-reunião, 15h, mãos de quem digita). Não é outra trilha com exercícios diferentes; é atalho.

---

## 2. Checklist C1–C14 (trilha proposta)

| # | Critério | Situação no desenho |
|---|---|---|
| C1 | Sobrecarga progressiva | ✅ seções sobem volume → cadência/pausa → unilateral/carga → densidade (§3) |
| C2 | Âncora + rodízio; ≤ 1 novo por lição | ✅ 2 âncoras por seção; 1 vaga de rodízio; matriz marca o "novo" |
| C3 | S1 dinâmica | ✅ AMRAP controlado e isometria curta |
| C4 | Ordem e ≤ 1 troca de câmera | ✅ uma posição por lição (meio corpo OU corpo inteiro) |
| C5 | Duração real = prometida | ✅ molde de 3 blocos fecha em 2:50–3:10 [conferir no validador] |
| C6 | Substituto E0 e sem impacto | ✅ todo E1/E2 com E0; sem salto em toda a trilha |
| C7 | Contextos | ✅ toda lição: mesa + sala; meio corpo também plantão e viagem |
| C8 | Variante avançada | ✅ coluna "Avançada" em toda lição (§4) |
| C9 | Variante improvisada e acessório | ✅ garrafa, mochila, cadeira, parede, toalha; elástico como E2 |
| C10 | Desafio da unidade compartilhável | ✅ 1 por seção (§5) |
| C11 | Teste de marca a cada 4 semanas + semana leve | ✅ Teste da Cadeira 30 s + questionário de dor (§5) |
| C12 | Validação definida | ⚠️ 14 exercícios novos sem regra de câmera (§6.3): especificar antes de codar |
| C13 | Hive mista | ✅ mesma família, degraus diferentes, card em % da própria meta |
| C14 | Copy dentro da marca e da ciência | ✅ "menos desconforto" / "mais disposição"; nunca "sem dor", "cura", "produtividade +X%" |

---

## 3. Estrutura: 4 seções × 4 lições + desafio da unidade

| Seção | Nome | Foco da dose | Método padrão | PSE | Âncoras (P) |
|---|---|---|---|---|---|
| **S1** | Destravar | amplitude e ritmo, volume baixo | AMRAP controlado 40 s · isometria 3 × 15 s | 2–3 | retração do queixo · sentar e levantar da cadeira |
| **S2** | Postura de volta | mais tempo sob tensão (pausa no fim do movimento, 2 s) | REPS com pausa · isometria 3 × 20 s | 3 | anjo na parede · bom-dia |
| **S3** | Força de mesa | unilateral e carga improvisada (garrafa, mochila) | REPS · AMRAP controlado | 3–4 | elevação lateral (garrafa) · abdução em pé |
| **S4** | Expediente forte | densidade leve (EMOM de 3 min, sem suor) | EMOM · isometria 3 × 25 s | 4 | remada (elástico ou toalha) · cadeira na parede |

Semana 4 de cada ciclo: **semana leve** (lições da seção anterior) + **teste de marca**.

---

## 4. Matriz de lições

Legenda de câmera: **MC** = meio corpo, sentado, celular no monitor · **CI** = corpo inteiro, em pé, celular a ~2 m. Bloco 3 é sempre saída curta (respiração ou mobilidade, 30–40 s). ★ = exercício novo para a pessoa naquela lição.

| Lição | Câmera | Bloco 1 · postura (cima) | Bloco 2 · força leve | Bloco 3 · saída | Avançada | Improvisada / acessório |
|---|---|---|---|---|---|---|
| **S1-L1** Pescoço solto | MC | retração do queixo ★ · AMRAP controlado 2 × 40 s | encolher e soltar ombros · 2 × 30 s | respiração diafragmática 40 s | retração com pausa de 3 s | — |
| **S1-L2** Levanta da cadeira | CI | elevação de braços em Y · 2 × 40 s | sentar e levantar da cadeira ★ · AMRAP 2 × 40 s | marcha estacionária 30 s | levantar sem as mãos, descida em 3 s | segurar garrafa no peito |
| **S1-L3** Coluna que gira | MC | inclinação lateral do pescoço ★ · 2 × 30 s/lado | rotação de tronco sentado · AMRAP 2 × 40 s | suspiro fisiológico 30 s | rotação com pausa de 2 s em cada lado | toalha esticada nas mãos |
| **S1-L4** Quadril acordado | CI | retração do queixo · 2 × 40 s | bom-dia · AMRAP 2 × 40 s | alongamento do flexor do quadril em pé ★ 2 × 20 s | bom-dia com pausa embaixo | mochila no peito no bom-dia |
| **Desafio S1** | CI | **Teste da Cadeira 30 s** (máximo de sentar e levantar com técnica) | | | | |
| **S2-L1** Ombro pra trás | MC | anjo na parede (sentado, costas na cadeira) ★ · REPS 2 × 8, pausa 2 s em cima | rotação do pescoço · 2 × 30 s | respiração quadrada 40 s | anjo em pé na parede, braços até o alto | — |
| **S2-L2** Pernas de reunião | CI | Y em pé · 2 × 40 s | agachamento parcial na cadeira · REPS 2 × 10, pausa 2 s embaixo | panturrilha em pé ★ 30 s | agachamento livre até a cadeira, sem encostar | garrafa nas duas mãos |
| **S2-L3** Costas retas | CI | extensão de coluna em pé ★ · 2 × 30 s | bom-dia · REPS 2 × 10 com pausa | apoio numa perna com toque 2 × 15 s/lado | apoio numa perna sem toque | — |
| **S2-L4** Lado firme | CI | inclinação lateral em pé (ABS-58) · 2 × 30 s/lado | prancha com mãos na mesa (ABS-30) · isometria 3 × 20 s | respiração diafragmática 40 s | prancha na mesa com mais inclinação (mãos mais baixas: cadeira) | — |
| **Desafio S2** | MC | **Hive Postural:** reps limpas de anjo em 60 s | | | | |
| **S3-L1** Ombro forte | MC | elevação lateral ★ · REPS 2 × 10 (E0: sem carga, 3 s subindo) | retração do queixo com pausa · 2 × 30 s | mobilidade de punho (guiada) 40 s | carga: garrafa 1,5 L | **E1 garrafa 0,5–1,5 L · E2 elástico** (Andersen) |
| **S3-L2** Glúteo de pé | CI | abdução em pé (GLU-23) · REPS 2 × 10/lado | stiff com pé de trás apoiado (GLU-12) · REPS 2 × 8/lado | marcha estacionária 30 s | stiff unilateral (GLU-11) | mini band acima do joelho na abdução |
| **S3-L3** Empurra a mesa | CI | Y em pé · 2 × 40 s | flexão inclinada na mesa ★ · AMRAP controlado 2 × 30 s | alongamento de posterior 30 s | mãos mais baixas (assento da cadeira fixa) | — |
| **S3-L4** Core em pé | CI | joelho ao cotovelo cruzado em pé (ABS-59) · AMRAP controlado 2 × 30 s | Pallof em pé (ABS-52) · 3 × 20 s | suspiro fisiológico 30 s | Pallof com passo para fora | **E2 elástico · E0: prancha com mãos na mesa** |
| **Desafio S3** | MC | **Hive de Ombros:** elevação lateral, reps limpas em 2 × 60 s (base: Andersen 2011) | | | | |
| **S4-L1** Remada de mesa | CI | remada ★ · EMOM 3 min (8 reps no início de cada minuto) | retração do queixo · 30 s | respiração quadrada 40 s | remada unilateral, pausa de 2 s atrás | **E2 elástico · E1 toalha (puxada isométrica) · E0 remada no ar** |
| **S4-L2** Cadeira na parede | CI | anjo na parede em pé · 2 × 8 | cadeira na parede (GLU-27) · isometria 3 × 25 s | panturrilha em pé 30 s | cadeira na parede numa perna apoiando a outra | mochila no colo |
| **S4-L3** Equilíbrio de mesa | CI | elevação lateral · 2 × 10 | avião (GLU-13) · isometria 3 × 15 s/lado | alongamento do flexor do quadril em pé 2 × 20 s | árvore | apoio leve na mesa (regressão) |
| **S4-L4** Expediente forte | CI | EMOM 3 min: 6 sentar e levantar + 6 remadas | — | respiração diafragmática 40 s | sentar e levantar numa perna até a cadeira (GLU-34) | mochila nas costas no sentar e levantar |
| **Teste de marca (semana 4)** | CI | **Teste da Cadeira 30 s** + **questionário de dor** (pescoço, ombro, lombar, cabeça, 0–10) | | | | |

**Contextos:** todas as lições valem para **mesa** e **sala**. As de **MC** valem também para **plantão** e **viagem** (sentado). **PSE alvo** em todos os blocos ≤ 4.

---

## 5. Desafios, teste e card
- **Teste da Cadeira 30 s** (sentar e levantar o máximo em 30 s, braços cruzados): teste de campo consagrado de força de membros inferiores [verificar fonte: Jones, Rikli e Beam, 1999]. Comparação só com a própria pessoa. Card: "Teste da Cadeira: 14 → 17 em 4 semanas".
- **Questionário de dor** (CIENCIA_BREAKS §4.3): 4 regiões, 0–10, no início e a cada 4 semanas. É o dado de resultado do **piloto B2B**. Mostrar à pessoa como "seu desconforto", nunca como diagnóstico.
- **Hive Postural** e **Hive de Ombros:** desafios de unidade compartilháveis, que dá para fazer em hive na sala de reunião ("quem fecha mais anjos limpos em 60 s?"). O popup do Hive de Ombros mostra a frase do estudo de Andersen 2011.
- Copy permitida: "Pausas curtas reduzem a fadiga" · "2 minutos por dia de exercício reduziram dor no pescoço e no ombro em trabalhadores de escritório" (Andersen 2011). Proibida: "sem dor", "previne lesão", "aumenta a produtividade".

---

## 6. O que construir (vira a lista da Etapa 1C)

### 6.1 Já no motor (13): usar como está
agachamento_parcial_cadeira (= sentar e levantar da cadeira) · agachamento_livre · bom_dia · bom_dia_bastao · elevacao_bracos_y · marcha_estacionaria · apoio_uma_perna · apoio_uma_perna_com_toque · postura_arvore · guerreiro_2 · alongamento_posterior · respiracao_guiada · polichinelo_sem_salto (fora do Office: faz suar).

### 6.2 Importar da biblioteca (regra de câmera pronta): 11, prioridade da 1C
| Doc | Exercício | V | Equip. |
|---|---|---|---|
| ABS-30 | Prancha com as mãos na mesa | V2 | E1 mesa (E0: ABS-31) |
| ABS-52 | Pallof em pé com elástico | V2 | E2 (E0: ABS-30, ajustar o substituto do doc, que hoje é ABS-39 no chão) |
| ABS-58 | Inclinação lateral em pé | V1 | E0 |
| ABS-59 | Joelho ao cotovelo cruzado em pé | V1 | E0 |
| ABS-60 | Joelhos ao peito sentado na cadeira | V1 | E1 cadeira |
| GLU-11 | Stiff unilateral | V1 | E0 |
| GLU-12 | Stiff com pé de trás apoiado | V1 | E0 |
| GLU-13 | Avião (isometria) | V2 | E0 |
| GLU-23 | Abdução em pé | V1 | E0 (E2 mini band) |
| GLU-27 | Cadeira na parede | V2 | E0 / parede |
| GLU-34 | Sentar e levantar numa perna até a cadeira | V1 | E1 cadeira (avançado) |

### 6.3 Exercícios novos: regra de câmera a especificar (14)
Proposta de leitura pela câmera; limiares todos **[validar]** no dia de calibração.

| ID | Exercício | Câmera | V | Como conta (proposta) |
|---|---|---|---|---|
| ESC-01 | Retração do queixo | MC, de lado | V1 | distância horizontal orelha → ombro (em largura de ombro) diminui e volta |
| ESC-02 | Inclinação lateral do pescoço | MC, de frente | V1 | ângulo da linha entre as orelhas com a horizontal > 20° e volta, por lado |
| ESC-03 | Rotação do pescoço | MC, de frente | V1 | nariz desloca > 0,35 W do centro dos ombros e volta, por lado |
| ESC-04 | Encolher e soltar os ombros | MC, de frente | V1 | distância orelha → ombro cai > 25% e volta |
| ESC-05 | Anjo na parede (sentado ou em pé) | MC/CI, de frente | V1 | cotovelos ~90° → punhos acima da cabeça com cotovelos acima da linha dos ombros → volta |
| ESC-06 | Elevação lateral | MC, de frente | V1 | ângulo quadril/tronco–ombro–punho de < 25° a 75–95° e volta; erro "acima do ombro" |
| ESC-07 | Remada (elástico, toalha ou no ar) | CI, de lado | V1 | cotovelo passa atrás da linha do tronco e volta à frente |
| ESC-08 | Rotação de tronco sentado | MC, de frente | V1 | largura aparente dos ombros cai ≥ 20% e volta (mesma lógica do ABS-48) |
| ESC-09 | Extensão de coluna em pé | CI, de lado | V1 | tronco inclina > 10° para trás da vertical e volta |
| ESC-10 | Alongamento do flexor do quadril em pé | CI, de lado | V2 | posição de afundo alto: joelho de trás estendido, quadril à frente; tempo válido |
| ESC-11 | Panturrilha em pé | CI, de lado | V1 | calcanhar sobe > 0,06 da altura da perna e volta (ponto do calcanhar do MediaPipe) |
| ESC-12 | Flexão inclinada na mesa | CI, de lado | V1 | ângulo do cotovelo 160° → < 100° → 160°, corpo em linha (LC 165–195) |
| ESC-13 | Mobilidade de punho | MC | V4 | guiada (a pose não vê bem a mão): não gera XP de câmera nem conta na liga |
| ESC-14 | Respiração diafragmática / quadrada / suspiro fisiológico | MC | V4 | variações guiadas de `respiracao_guiada` (só áudio e tempo) |

**Atenção técnica:** ESC-01 a ESC-08 dependem de o motor aceitar `pontos_obrigatorios` só de cima e de um **enquadramento "meio corpo"** no aviso de posição (hoje o aviso pede o corpo inteiro). É a primeira extensão do motor da 1C.

---

## 7. Hive Office (acessória) refeita como kit de resets
| Hive | Momento | Conteúdo | Tempo |
|---|---|---|---|
| Pescoço livre | qualquer hora | retração do queixo + inclinação lateral + rotação | 2 min (MC) |
| Reset pós-reunião | depois de call longa | suspiro fisiológico + rotação de tronco sentado + extensão de coluna | 2 min |
| Mãos de quem digita | meio da manhã | mobilidade de punho + encolher ombros | 1 min (V4) |
| Destrava o quadril | depois do almoço | flexor do quadril em pé + bom-dia + panturrilha | 3 min (CI) |
| Postura de volta | 15h | anjo + elevação lateral + Y | 3 min (MC) |
| Energia das 15h | 15h | sentar e levantar + marcha + Y | 3 min (CI) |

Os 6 hoje no app (árvore, apoio numa perna, marcha, Y, posterior, respiração) saem da Hive Office e ficam só na trilha principal.

---

## 8. Respostas do Luan (20/11) e pendências
- ✅ **Ordem das seções e molde de 3 blocos:** aprovados para teste.
- ✅ **Anjo sentado** (costas e braços no encosto da cadeira) vale como versão MC.
- ✅ **EMOM do S4 com 8 remadas por minuto**, com sobrecarga alta (elástico forte ou carga improvisada pesada). Atenção: com carga alta a PSE pode passar de 4. Proposta: S4-L1 e S4-L4 com PSE alvo 5, contexto **sala** (não **mesa**), já que é força sem impacto e sem suor de cardio [validar].
- ✅ **Nomes dos desafios (20/11):** S2 = **Hive Postural**, S3 = **Hive de Ombros**.
- ✅ **14 exercícios novos (§6.3):** proposta aprovada pelo Luan (limiares seguem [validar] na calibração). Nenhum sai, nenhum entra; pinça de escápula fica de fora por enquanto (a câmera não vê).
- ✅ **Regra para os movimentos sutis** (retração do queixo, extensão de coluna e qualquer outro que a calibração mostrar instável): o bloco é **sempre por tempo (30–40 s)** e **avança sozinho** no fim, mesmo que a câmera não tenha contado nenhuma rep. Se a câmera contou, vale normal (XP e liga). Se não contou mas o corpo estava no quadro, a série vale como **guiada** (ofensiva sim, liga não) e o resultado mostra "Feito" no lugar do número. Nunca trava a pessoa nem mostra "0 reps" como fracasso.
- ⏳ Carga da garrafa na elevação lateral (0,5 L iniciante, 1,5 L avançado?).
- ⏳ Teste da Cadeira 30 s como teste de marca do Office e questionário de dor já no MVP.

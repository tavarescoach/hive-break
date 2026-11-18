# Registro de decisões

Decisões tomadas durante a construção, com o motivo. As marcadas com **(Luan)** foram
respondidas por ele; as marcadas com **(revisar)** são provisórias e dependem do teste
com pessoas reais.

## Fase 0 — teste técnico (16/11/2026)

### Produto e processo

1. **Fixtures de landmarks: sintéticas + gravador (Luan).** A seção 12.3 proíbe salvar
   pontos do corpo frame a frame, mas os testes do motor pedem sequências gravadas.
   Resolução: as fixtures do repositório são geradas por script (boneco 3D); a página
   `/teste-tecnico` tem uma opção, desligada por padrão, que guarda os pontos da tentativa
   e deixa a pessoa baixar o arquivo no próprio aparelho. Nada é enviado sozinho. Arquivos
   de testadores que consentirem entram em `fixtures/reais/`. Essa opção existe só na
   página de teste técnico; a regra da seção 12.3 vale para o produto.
2. **Teste no celular pela URL de preview da Vercel (Luan).** Push só na branch de
   trabalho; sem PR e sem mexer na `main`.
3. **O projeto já nasce como app Next.js** (App Router, TypeScript, Tailwind), para a
   Fase 1 continuar no mesmo código. A Fase 0 vive em `/teste-tecnico`.

### Motor de detecção

4. **Motor genérico desde a Fase 0.** Os três exercícios são arquivos JSON em
   `src/exercicios/`, lidos pelo mesmo motor (`src/motor/`). Não há código específico
   por exercício. O motor é TypeScript puro, sem DOM, e roda igual nos testes.
5. **Condições em texto, como no exemplo da seção 8.2**, lidas por um interpretador
   próprio (`src/motor/expressao.ts`), sem `eval`. Aceita `>`, `<`, `>=`, `<=`,
   `entre A e B`, `e`, `ou`, `nao`, contas, `abs()`, `min()`, `max()` e `dist()`.
6. **Medidas nomeadas.** Além da `medida_principal` da spec, a definição pode ter um
   bloco `medidas` (ex.: `maos_cabeca`, `maos_ombro` no polichinelo). Três tipos:
   `angulo`, `distancia` e `altura`, as duas últimas com `normalizar_por` para não
   depender da distância da pessoa até a câmera. Nas condições de fim de repetição
   existem `min_<medida>` e `max_<medida>`.
7. **Ângulo do joelho em 3D no agachamento de frente (revisar).** A spec pede o ângulo
   quadril–joelho–tornozelo com câmera frontal. Na imagem 2D de frente esse ângulo quase
   não muda (o joelho vem na direção da câmera), então o motor usa os pontos 3D do
   MediaPipe (`worldLandmarks`). O ângulo 2D aparece no painel de medidas como
   `joelho_2d` para comparação. É o ponto de maior risco de calibração: a profundidade
   estimada de frente costuma ser menos precisa que de lado.
8. **Suavização com filtro One Euro** nas coordenadas (a seção 7 aceita média móvel ou
   One Euro; a 8.1 pede One Euro).
9. **Histerese:** 5° nas fases com ângulo (spec). Para medidas em proporção, a folga é
   definida na definição do exercício (0,1 no polichinelo; 0,04 no apoio).
10. **Antifraude de tempo mede o ciclo inteiro.** "Repetição completa de pelo menos
    400 ms" é medido de uma chegada à posição inicial até a próxima, não só o trecho em
    movimento (senão polichinelo a 100 por minuto seria recusado). No agachamento o
    mínimo é 500 ms (seção 9.5: mais de 2 por segundo não conta). Repetição rápida
    demais é registrada à parte (`reps_rapidas`) e não soma.
11. **Parcial do agachamento: `min_medida < 120`** em vez de "entre 100 e 120". Assim uma
    repetição que encosta nos 100° por menos de 150 ms (sem confirmar a fase "fundo")
    vira parcial, em vez de sumir.
12. **Polichinelo (revisar).** "Pés juntos" = distância entre tornozelos menor que
    1,0× a largura dos ombros (a spec não dá número). "Mãos acima da cabeça" = os dois
    punhos acima do nariz. Braços que não sobem: a repetição vira parcial com o aviso
    "Braços acima da cabeça". Pernas pouco abertas (entre 1,15× e 1,5×): parcial com
    "Abra mais as pernas".
13. **Apoio em uma perna (revisar).** "Pé fora do chão" = um tornozelo pelo menos 15% do
    comprimento do tronco acima do outro. O lado é detectado sozinho. O tempo só corre
    com o pé no ar. O erro "braços buscando apoio" ainda não é detectado.
14. **Fora do quadro:** ponto obrigatório com visibilidade abaixo de 0,6 faz o frame ser
    ignorado; 1 s seguido sem frame válido dispara "não estou te vendo" e descarta o
    movimento em curso. A contagem retoma sozinha.

### Câmera, privacidade e rede

15. **Modelo e WASM do MediaPipe servidos do nosso domínio.** O script
    `scripts/preparar-mediapipe.mjs` copia o WASM de `node_modules` e baixa os modelos
    *lite* e *full* para `public/mediapipe` (fora do git) na instalação e no build.
    No build, se faltar algum arquivo, o build falha.
16. **Bloqueio de conexões externas por CSP (`connect-src 'self'`).** O teste de rede
    mostrou que a biblioteca `@mediapipe/tasks-vision` 1.2.3 tenta enviar estatísticas
    de uso (cerca de 140 bytes, sem imagem) para `odml.pa.googleapis.com`. A biblioteca
    não tem opção para desligar isso, então o site instrui o navegador a recusar
    qualquer conexão fora do próprio domínio. O console mostra o bloqueio; é esperado.
    Na Fase 1 o domínio do Supabase entra nessa lista.
17. **Modelo *lite* por padrão**, com troca para *full* nas opções de teste. GPU (WebGL)
    com queda automática para CPU.
18. **Vídeo inteiro na tela (sem cortar as laterais).** Na página de teste a imagem da
    câmera aparece completa, com faixas pretas, para a pessoa ver exatamente o que o
    detector vê.
19. **Início sem tocar no celular.** A contagem regressiva de 5 s começa sozinha quando
    o corpo inteiro fica visível por 1,5 s; há também o botão "Começar agora".

### Perguntas em aberto para o Luan

- A duração mínima de fase de 150 ms (seção 7) pode ser curta demais para polichinelo
  muito rápido em celular lento (a 20 fps, 150 ms são 3 quadros). Nos testes sintéticos
  passou a 100 por minuto. Se o teste real perder repetições rápidas, proponho baixar
  para 100 ms só nesse exercício. Mantive 150 ms por enquanto.
- Os limiares das decisões 7, 12 e 13 precisam de revisão técnica (pergunta já listada
  na seção 2 da spec: quem revisa os critérios de cada exercício?).

## Fase 0 — resultado

- **Aprovada pelo Luan em 16/11/2026**: testou e pediu para outras pessoas testarem; a
  contagem ficou com "uma razão muito boa". Os limiares das decisões 7, 12 e 13 ficam
  como estão até aparecer um caso real de erro. Nenhuma gravação real foi adicionada a
  `fixtures/reais/` ainda.

## Fase 1 — fundação (16/11/2026)

### Respondidas pelo Luan

20. **Cadastro aberto.** Qualquer pessoa com o endereço entra com Google. O convite só
    registra quem indicou.
21. **Maiores de 60 anos são aceitos.** Só menores de 18 são barrados. As faixas etárias
    passam a ser 18-29, 30-39, 40-49, 50-59 e 60+.
22. **Liberação médica por autodeclaração.** Quem respondeu "sim" na triagem marca no
    perfil "Meu médico me liberou para exercício intenso"; o app guarda a data.
23. **Marca:** Hive Break com a assinatura "por Luan Tavares · Treinador".

### Banco e segurança

24. **As 30 tabelas da seção 11 são criadas já na Fase 1**, todas com RLS. O seed de
    exercícios, desafios e blocos fica para a Fase 3 (depende das definições da Fase 2) e
    o de textos de aviso para a Fase 5. Agora entram os 8 níveis e as conquistas.
25. **Privilégios começam do zero.** As migrações retiram tudo de `anon` e
    `authenticated` e concedem tabela por tabela, coluna por coluna. O dono do perfil só
    edita os dados que ele mesmo informa; dificuldade, liberação, divisão, nível, código
    de convite, "convidado por" e conclusão do cadastro só mudam por funções do servidor.
    As tabelas de jogo (tentativas, XP, ofensiva, liga, convites) são só leitura para o
    cliente.
26. **Dados públicos por view.** Outros usuários enxergam apenas `perfis_publicos`
    (apelido, foto, divisão, nível). A landing de convite usa a função `convite_publico`,
    que devolve só apelido, foto e ofensiva.
27. **E-mail fica só no Auth do Supabase**, não é copiado para `profiles`.
28. **Colunas a mais em `profiles`:** `nome`, `avatar_url`, `nivel_atual`,
    `liberacao_declarada_em`, `onboarding_concluido_em`, `atualizado_em`. Em
    `music_tracks`: data de registro da licença e comprovante (seção 12.6).
29. **Convite:** o código fica num cookie (14 dias) entre a landing `/c/[codigo]` e o
    login. `registrar_convite` vale uma vez, só para conta nova (até 7 dias, cadastro não
    concluído), nunca para o próprio código. Recompensa e antifraude entram na Fase 4.
30. **Código de convite sem I, O, 0 e 1**, para não confundir quem digita.
31. **Dificuldade inicial sem nivelamento (revisar):** sedentário 2, pouco ativo 3,
    ativo 5; sem liberação, no máximo 3 (seção 6.5).
32. **Testes de RLS em Postgres embutido (PGlite)** com as migrações reais, e teste de
    ponta a ponta contra um servidor Supabase falso (`e2e/`), porque não há projeto
    Supabase nem Docker neste ambiente. O login real com Google só pode ser conferido
    no projeto do Luan.

### Telas

33. **Compromisso de ofensiva junto da meta diária** (`/onboarding/meta`), com o botão
    "Assumir meu compromisso" (seção 10.2). O mapa de telas não tinha tela própria.
34. **Ordem do primeiro acesso:** termos → 9 perguntas de perfil → triagem → meta e
    compromisso → câmera → música → trilha. O nivelamento entra depois da música na
    Fase 3; a prévia de 10 s das músicas, na Fase 2 (ainda não há faixas escolhidas).
35. **Fuso horário lido do aparelho** durante o cadastro e validado no servidor.
36. **Altura aceita metros ou centímetros** ("1,72" vira 172).
37. **Câmera negada não trava o cadastro:** a pessoa segue e usará o modo manual.
38. **Textos da triagem** seguem as 7 perguntas gerais do PAR-Q+ (revisar), e os
    **termos e a política** são um rascunho com versão `2026-11-rascunho-1` (revisão
    jurídica pendente).

### Perguntas em aberto para o Luan

- A seção 11.3 fala em 12 conquistas, mas a seção 9.6 lista 13. Cadastrei as 13.
- Vídeo curto da landing (seção 3.1): ainda não existe. A landing está só com texto.
- Apelido não é único (duas pessoas podem se chamar "Ana"). Mantenho assim?

## Trilha em unidades, no modelo do Duolingo (17/11/2026)

Pedido do Luan. Muda a estrutura da seção 6 da especificação.

### Respondidas pelo Luan

39. **Estrutura: Nível (seção) → Unidade temática → Desafios**, com **3 unidades por
    nível** (24 unidades). Cada unidade tem de 8 a 12 desafios na ordem fisiológica da
    seção 6.2 (8 nos níveis 1 e 2; 10 nos níveis 3 a 5; 12 nos níveis 6 a 8) e termina no
    "Desafio da unidade". A "sessão completa de 40 a 60 min" passa a ser a unidade.
40. **Modo provisório dá XP cheio.** Enquanto a câmera não confere os exercícios, o
    desafio é um timer com o botão "Concluí": 10 XP (+5 no primeiro do dia), conta para a
    ofensiva, sem nota, estrelas nem pontos de liga. Quando a câmera entrar, esse caminho
    vira o "modo manual" da seção 3.5 (50% do XP).
41. **"Pular para cá" libera a seção** sem fazer as anteriores, e a pessoa passa a
    continuar dela. As anteriores seguem disponíveis.
42. **Baú de XP vale 10; "Desafio da unidade" vale 20.** Há um baú a cada 4 desafios.

### Decididas na implementação

43. **Liberação em fila dentro da seção.** Um desafio fica disponível quando a seção está
    liberada e não há nada pendente antes dele. Concluir todos os desafios da seção
    conclui o nível (+30 XP, seção 9.2) e libera a seguinte.
44. **Quem está limitado pela triagem não fica preso.** Desafios de intensidade média ou
    alta aparecem como "travados por segurança" e não seguram a fila: a pessoa segue pelos
    de baixa intensidade (aquecimento, mobilidade, equilíbrio, yoga, volta à calma) e
    fecha a unidade por eles. Ao declarar liberação, os travados voltam a ser pendentes.
    O aquecimento foi classificado como baixa intensidade (revisar).
45. **Refazer no mesmo dia não soma XP de novo.** Como o modo provisório não tem
    validação por câmera, isso evita acumular XP só tocando em "Concluí".
46. **Ofensiva em versão simples.** Concluir um desafio marca o dia e soma dias seguidos
    no fuso da pessoa; a tela mostra zero quando o último dia ativo foi antes de ontem.
    Protetor, recuperação, marcos, semana perfeita e a virada do dia por cron continuam
    na Fase 4.
47. **Meta de XP do dia segue o perfil** (10 × desafios por dia: 10, 20 ou 30), como na
    seção 9.2. O pedido citava "x/30"; quem escolheu 3 desafios vê exatamente isso.
48. **Conteúdo gerado por script** (`scripts/gerar-seed-trilha.ts` → `supabase/seed_trilha.sql`):
    os 19 exercícios, nomes das 24 unidades, exercícios de cada desafio e durações. É um
    rascunho para revisão técnica. Só 3 exercícios têm definição para o motor; os outros
    16 entram na Fase 2. Séries, repetições e escala por dificuldade entram na Fase 3.
49. **Tabelas novas:** `units` e `user_chests` (o banco passa a ter 32 tabelas);
    `challenges` ganhou `unit_id` e `tipo`; `user_challenge_progress` ganhou `concluido_em`.
50. **O banner amarelo mostra a unidade que ocupa o meio da tela**, e a tela rola sozinha
    até o desafio atual ao abrir e depois de pular de seção.

### Pendências desta mudança

- Progresso do compromisso de ofensiva (seção 10.2) saiu da Trilha no redesenho; volta
  com a tela de ofensiva na Fase 4.
- Pular para uma seção que pede equipamento que a pessoa não tem só mostra um aviso; a
  troca por alternativas sem equipamento (seção 3.3) é da Fase 3.
- "Nível completo numa única sessão" (+50 XP) precisa ser redefinido para a unidade.

## Desafios com câmera e regras novas de XP (17/11/2026)

### Respondidas pelo Luan

51. **Decisões 39 a 50 aprovadas.**
52. **+50 XP passa a valer para a unidade completa numa única sessão.**
53. **Refazer um desafio dá 1/3 do XP, uma vez por desafio por dia** (substitui a decisão 45).
54. **Câmera agora.** O documento `docs/REFERENCIAS_PRODUTO.md` sugere a validação por
    câmera como último passo, mas o Luan pediu para ligá-la nos desafios já. Parte desta
    tela será refeita quando os métodos da seção 6 daquele documento (Tabata, EMOM,
    AMRAP, cadência) forem definidos.

### Decididas na implementação

55. **Os 19 exercícios têm regras de detecção** em `src/exercicios/*.json`. Só agachamento
    livre, polichinelo e apoio em uma perna foram testados com pessoas (Fase 0). Os outros
    16 usam os valores iniciais da especificação e foram testados só com sequências
    sintéticas ou pela validação da definição: **precisam de calibração com pessoas reais**.
56. **Formatos novos no motor:** `alternado` (marcha, skipping, mountain climber: cada lado
    conta quando a condição dele vale, e só volta a contar depois de voltar ao repouso),
    `precisao` (alvos que aparecem ao alcance das mãos) e `respiracao` (a câmera só mede se
    a pessoa está parada). Medidas novas: `inclinacao` (deitado ou em pé) e `movimento`.
57. **Exercícios de lado para o celular** usam o lado do corpo que a câmera enxerga melhor
    (`lado: "visivel"`) e ângulos 2D; basta um dos lados visível para o frame valer.
58. **Elevação em Y conta a partir de 150°** (a especificação diz 160°): com os braços em Y
    o ângulo real fica perto de 150°. Revisar no teste.
59. **Simplificações a revisar:** o afundo não confere "joelho de trás perto do chão" nem
    separa os lados; a marcha não confere o braço oposto; o toque nos alvos usa só as mãos;
    o Guerreiro II não mede semelhança com a pose-modelo.
60. **Blocos por tempo.** Cada exercício do desafio dura o tempo definido no conteúdo; a
    tela mostra a contagem ao vivo e o anel do tempo. Metas de repetições e séries ("8/12",
    "2ª série de 3") dependem dos métodos e da escala por dificuldade, que ainda não existem.
61. **O tempo do exercício para quando a pessoa sai do quadro** e volta sozinho.
62. **Modo sem câmera vale metade do XP** (seção 3.5): 5 por desafio, 10 no desafio da
    unidade, +3 no primeiro do dia. É o caminho de quem nega a câmera ou escolhe o timer.
63. **Câmera sem movimento vale como sem câmera.** Se a câmera não contar nada em pelo
    menos metade dos exercícios, o servidor aplica o XP do modo manual.
64. **"Unidade numa única sessão" = do primeiro ao último desafio em até 3 horas** (revisar).
65. **O servidor recusa números impossíveis:** mais de 4 repetições por segundo, tempo
    válido maior que o tempo do exercício, bloco que não existe. O score de 0 a 100 e os
    pontos de liga continuam na Fase 4; por enquanto os KPIs ficam guardados em
    `attempt_blocks`.
66. **"Senti dor"** pausa o desafio, pergunta a região, registra em `pain_reports` e
    encerra sem XP. Trocar o exercício por alternativa e "sem perder a ofensiva" ficam
    para depois.
67. **Voz do treinador** pela Web Speech API (pt-BR), no máximo uma frase a cada 4 s.
68. **As regras usadas pela câmera vêm dos arquivos do app**, não do banco: assim uma
    correção de limiar não depende de rodar SQL. O seed mantém a cópia no banco.

## Métodos dos desafios (18/11/2026)

Detalhes em `docs/METODOS.md`.

### Respondidas pelo Luan

69. **Métodos:** intervalado por tempo (AMRAP, faixa de reps ou sustentar), Tabata
    (8 × 20/10), séries e repetições, circuito, EMOM, escada e contra o relógio.
70. **Trabalho em amarelo-mel**, descanso em cinza, preparo e transição em branco.
71. **A série de repetições espera a pessoa** completar (sem teto de tempo).
72. **Limite de 5 minutos inclui os descansos**, aplicado à duração planejada.

### Pedidas no teste do Luan

73. **"Concluí" não encerra mais o desafio.** O topo tem "Pular ›" (fecha a fase atual e
    segue; na última vira "Concluir") e um X para encerrar o desafio registrando o que
    foi feito.
74. **Timer grande:** o painel da fase ocupa cerca de 1/3 da tela em trabalho, com
    números de 7 a 9 rem; no descanso o painel cinza cobre a tela com a contagem enorme.
75. **Gabarito da posição** para os 19 exercícios: figura de palito parada nas
    isometrias e posturas, animada nos exercícios de repetição. Aparece na tela de
    preparação, no descanso (próximo exercício), no canto da câmera durante as
    sustentações e grande no modo sem câmera.

### Decididas na implementação (revisar)

76. **Método por posição da unidade** (tabela da seção 3 de `docs/METODOS.md`):
    aquecimento intervalado 30/10 com faixa; mobilidade em circuito; equilíbrio e yoga
    sustentando; força em séries e repetições (EMOM na 3ª unidade de cada seção); CORE em
    circuito; condicionamento alternando circuito e intervalado AMRAP; HIIT em Tabata;
    volta à calma em circuito de 1 rodada; desafio da unidade alternando contra o
    relógio, escada e circuito.
77. **Progressão por seção:** reps de força 8 → 10 → 12 → 15 (tronco 6 → 12), descanso
    60 → 30 s; isometria 20 → 45 s; condicionamento 30 → 45 s de trabalho. Se passar de
    5 min, o gerador reduz séries, rodadas ou reps até caber.
78. **Ritmo de referência** (s por repetição) em cada exercício, usado para planejar a
    duração e as metas de faixa: agachamento 3, polichinelo 1,5, skipping 0,6 etc.
    Faixa do aquecimento = 60% a 90% do ritmo de referência.
79. **Sustentação cumprida** = pelo menos 80% do tempo da fase na posição.
80. **Tabata** alterna os exercícios a cada round; o resultado mostra a soma e o pior round.
81. **Exercícios por tempo sem câmera** contam o tempo; os por repetição pedem o toque em
    "Feito".
82. **O XP não muda com o método** (10 por desafio, 20 no da unidade). Tabela de XP por
    método segue em aberto (item 2 das decisões do documento de referências).

## Desafios em blocos com variáveis metodológicas (18/11/2026)

### Respondidas pelo Luan

83. **Todos os métodos continuam.** O importante é que cada exercício tenha as variáveis
    (método, séries, esforço ou reps-alvo, pausa, score, PSE, cadência, ADM, ação) e que
    elas fiquem claras rápido para o usuário.
84. **Pop-up "PREPARE-SE"** antes de cada exercício, com instruções rápidas, contagem de 5 a
    10 s configurável e o botão "Ok, let's hive" para pular.
85. **Card** no formato "AMRAP · 5 × 40 s · pausa 20 s · de frente para o celular" +
    "Score: …", com a duração calculada no cabeçalho.
86. **No fim:** resumo por série e PSE.
87. **n6u1d07** como pedido: prancha isometria 3 × 30 s + mountain climber AMRAP 3 × 30 s,
    pausas de 20 s (280 s).

### Decididas na implementação (revisar)

88. **n1u1d03 continua em 3 × 8 repetições** (o pedido citava AMRAP 5 × 40 s; para o
    Nível 1, densidade alta no primeiro dia foi considerada pesada). Trocar é uma linha no
    gerador.
89. **Organização em sequência ou alternada** no desafio, para não perder circuito, Tabata
    alternado e escada. Escada = bloco de repetições com uma meta por série.
90. **Câmera (frente ou lado) vem do exercício**, não do bloco: as regras de detecção de cada
    exercício já são de um ângulo só.
91. **O pop-up absorve a pausa anterior** (fica com a maior das duas) para não alongar o
    desafio. Antes, a contagem esperava o corpo aparecer; agora é por tempo, e o relógio
    do esforço para se a pessoa não aparecer.
92. **Variáveis por posição da unidade:** PSE 2 (volta à calma) a 8 (HIIT); cadência 3-0-3-0
    na mobilidade e 2-0-1-0 (seções 1 a 4) ou 3-0-1-0 (5 a 8) na força; ADM completa;
    ação isométrica nas sustentações e mista no resto. A cadência e a ADM são informativas
    por enquanto: a câmera ainda não reprova uma repetição fora da cadência.
93. **Exercícios rápidos** (skipping, mountain climber) passam a ser por tempo (AMRAP) em
    vez de metas de 40 a 60 reps; metas por repetição limitadas a 40.
94. **PSE** gravada em `challenge_attempts.esforco_percebido` pela função
    `registrar_esforco` (tentativa mais recente do desafio, nas últimas 3 horas).
95. **Contagem do "Prepare-se"** em `profiles.contagem_preparo_s` (5 a 10, padrão 10),
    escolhida em Perfil > Configurações (5, 8 ou 10 s).
96. A coluna `metodo` (formato da migração 0008) fica vazia; o app converte o formato
    antigo se encontrar um desafio sem `estrutura`.

## Avaliação menos exigente e avisos de posicionamento (18/11/2026)

Teste do Luan no celular: a prancha não contava porque o corpo inteiro não cabia na
imagem, e o agachamento marcava "joelhos para dentro" em 8 de 11 repetições (falso
positivo).

### Respondidas pelo Luan

97. **Avaliação menos exigente.** Muitas vezes a pessoa não terá espaço para aparecer
    inteira, e a meia repetição precisa ser validada, com o aviso ("Desça mais").
98. **O celular fica sempre em pé.** Nunca pedir para girar o celular; os avisos indicam
    como se posicionar.
99. **Joelhos para dentro:** limite afrouxado.
100. **Pop-up com pausa longa** mostra "Pausa · Prepare-se".

### Decididas na implementação (revisar no próximo teste)

101. **Visibilidade mínima dos pontos de 0,6 para 0,5.**
102. **Menos pontos obrigatórios:** os pés deixam de ser obrigatórios no agachamento,
     afundo, flexão, prancha, mountain climber, bom-dia, alongamento, guerreiro e cachorro.
     A prancha passa a medir ombro-quadril-joelho (antes ombro-quadril-tornozelo).
103. **Meia repetição conta, com aviso:** agachamento vale a partir de 120° no joelho
     (antes 100°) e avisa "Desça mais" acima de 100°; afundo a partir de 115°; flexão a
     partir de 110° no cotovelo ("Desça mais o peito" acima de 90°); ponte a partir de
     155° ("Suba mais o quadril" abaixo de 165°); elevação em Y a partir de 135°; bom-dia
     a partir de 125°. Mais raso que isso vira parcial (não conta), com o mesmo aviso. O
     aviso aparece na faixa vermelha e na voz, e a meia repetição pesa menos na amplitude
     e na técnica.
104. **Polichinelo:** abertura das pernas a partir de 1,3× a largura dos ombros (antes 1,5×);
     mãos acima dos ombros contam, com o aviso "Braços acima da cabeça"; abaixo dos ombros
     não contam ("Suba os braços").
105. **Joelhos para dentro:** joelhos a menos de 70% da distância dos tornozelos (antes 80%),
     e só quando os tornozelos estão bem visíveis (nova função `vis()` nas regras).
106. **Outras folgas:** skipping e marcha com o joelho um pouco mais baixo; posturas de
     yoga, árvore, apoio em uma perna e respiração com faixas mais largas; alvos maiores e
     com 2,5 s para tocar.
107. **Avisos de posicionamento** (`src/motor/enquadramento.ts`): dizem qual parte do corpo
     não aparece ("Não vejo seus pés: afaste-se um pouco ou incline o celular para baixo")
     e avisam "Vire de lado" / "Fique de frente". Aparecem ao vivo no pop-up (verde quando
     está tudo certo) e durante a série.

## Hive ao vivo (19/11/2026)

Telas: aba Hive (hives na sala ou em andamento, com Join), sala de espera de 60 s,
faixa de colegas no topo da tela do exercício e card de resultado coletivo.

### Respondidas pelo Luan

108. **Modo competição** opcional: o anfitrião liga na sala, e os reps de todos aparecem
     ao vivo. Desligado (padrão), cada um vê só os próprios números; os colegas aparecem
     com a etapa (série, pausa, terminou) e a comparação fica no card do fim.
109. **Join a qualquer momento**, inclusive com a hive em andamento ("o objetivo é hive").
     Quem chega atrasado faz o desafio do início, no próprio relógio, e entra no mesmo card.
110. **Todos veem e todos podem dar join** (não só amigos).

### Decididas na implementação (revisar)

111. **Desafio bloqueado na trilha** pode ser feito por quem está numa hive dele (até 3 h
     depois do join). Travado pela triagem continua travado: a pessoa não entra.
112. **Anfitrião** só abre hive de desafio liberado para ele, e uma de cada vez. Pode
     começar antes dos 60 s.
113. **Fim da hive:** duração do desafio + 3 min; cada join atrasado empurra o fim.
114. **Sem vídeo:** o canal Realtime leva só etapa, série e reps. Na pausa, tocar num
     colega manda um high five.
115. **Sem bônus de XP por hive** por enquanto (valor a definir). Coluna `visibilidade`
     já existe ('aberta' | 'equipe') para hive fechada de empresa no futuro.
116. **Quem abre o link sem login** vai para a tela de entrar e, depois, para a trilha (não
     volta sozinho para a hive).

## Liga semanal (17/11/2026)

Regras completas na seção 9.3 da especificação. Código em
`supabase/migrations/20261119002000_liga.sql`, `src/dominio/liga.ts` e `src/app/(app)/liga/page.tsx`.

### Respondidas pelo Luan

117. **Grupo menor que 30:** sobe e desce proporcional (7 e 5 em cada 30); com menos de 5
     pessoas só o 1º sobe e ninguém desce.
118. **Entrada:** no 1º desafio válido da semana, não só na segunda.
119. **Ninguém é exposto:** a tela mostra o pódio, a pessoa e quem está logo acima; a zona
     de descida só aparece para a própria pessoa, com quanto falta para ficar.
120. **Pontos:** XP da semana, só de desafios com câmera (sem modo manual, respiração,
     convites e nivelamento). Agrupar por dificuldade parecida saiu do MVP.

### Decididas na implementação (revisar)

121. **Semana no horário de Brasília para todos**, de segunda 00h00 a domingo 23h59, mesmo
     para quem tem outro fuso no perfil.
122. **Empate:** fica na frente quem chegou primeiro àqueles pontos.
123. **Quem sobe ganha 1 protetor de ofensiva** (seção 10.2), respeitando o limite de 2 (4
     com ofensiva de 100 dias ou mais), e a conquista "Primeira subida de divisão".
124. **Fechamento:** pg_cron toda segunda às 00h01. Sem pg_cron, a semana fecha sozinha na
     primeira vez que alguém abre a Liga ou pontua na semana seguinte.
125. **Fora do quadro:** a média de `fora_quadro_pct` dos exercícios do desafio acima de 30%
     tira o desafio da liga (o XP continua valendo para a trilha).
126. **Nível concluído** vale para a liga quando o desafio que fechou o nível foi feito com
     a câmera.

## Lembretes (20/11/2026)

Regras e textos: FUNIL_LEMBRETES.md (v2). Configuração: `docs/CONFIGURACAO.md`, seção 6.

### Respondidas pelo Luan

1. **Lembretes vêm ligados.** Não existe "Ativar"; existe "Desativar" por categoria e geral,
   em `/perfil/config` e no rodapé de todo e-mail.
2. **n8n no servidor próprio** agenda e envia (e-mail pelo Gmail); banco e app cuidam das
   regras, dos textos, do push e do "desativar".
3. **R0 no horário da última prática**, com A/B de 12h; ofensiva às 20h (R1) e 22h (R1b);
   pausa depois de 14 dias (W3); 1 e-mail e 3 push por dia; silêncio das 22h30 às 8h.

### Decididas na implementação (revisar)

4. **Um envio por gatilho, canal e dia.** Vale também para S1 (se duas pessoas entrarem na
   sua hive no mesmo dia, só a primeira gera aviso) e garante "S4 no máximo 1 por dia".
5. **No máximo 1 push por pessoa em cada rodada de 15 min.** Quando dois gatilhos coincidem,
   vai o de maior prioridade; o outro sai na rodada seguinte, se a janela ainda valer.
6. **Janelas:** gatilhos "no horário X" valem de X até X + 1 h (R1: 20h–22h; R1b: 22h–22h30;
   S3: 18h–20h; R2: sábado 10h–12h). Se o n8n ficar fora por mais que isso, o aviso do dia
   é perdido, não acumulado.
7. **Canal:** R1b, H1, H2, S4 e S6 são só push (sem push, não saem). A2 tem push em +2 h e
   e-mail em +24 h. Os demais "push" caem para e-mail quando a pessoa não tem push.
8. **A5 ("primeiro convite")** sai a partir do 3º dia para quem treinou ontem ou hoje e
   nunca convidou ninguém. "Convidou" = alguém se cadastrou pelo link **ou** a pessoa tocou
   em Convidar/Copiar link (evento `invite_sent`).
9. **S4 (ultrapassagem)** vai para amigos do mesmo grupo da liga, sem depender do modo
   competição, que só existe na hive. Nunca mostra posição.
10. **S6 (high five) agrupado:** um push por dia. Se já chegaram vários, sai "{qtd} pessoas
    te mandaram high five hoje". O high five passa a ser gravado em `high_fives`.
11. **H1 e H2** já estão no motor, mas a hive ainda começa na hora em que é criada: H1 só
    vai funcionar quando existir a tela de agendar hive.
12. **S3 (dupla em risco)** usa as ofensivas individuais dos dois (`friend_streaks` ainda não
    é atualizada por nada).
13. **Pausa do W3** grava `pausado_ate = infinity` e corta tudo, inclusive avisos sociais.
    Qualquer desafio concluído tira a pausa. Na simulação, o W3 não pausa ninguém.
14. **Horário do lembrete** (perfil) só vale para quem ainda não treinou (e-mail do A2).
    Depois, manda o horário da última prática, como no FUNIL.
15. **Push de madrugada não sai, nem imediato.** E-mail imediato (A1, A3...) sai a qualquer hora.
16. **"Desativar" pelo link** acontece quando a página abre no navegador, e não no simples
    acesso ao link, para filtros de e-mail que visitam links não desligarem nada.
17. **Sem chave `service_role` no app.** As rotas sem login (push, abertura, desativar) usam
    funções do banco que conferem o segredo ou o HMAC.
18. **Disparo de teste do admin** ignora simulação, limites e preferências, e usa valores
    de exemplo para o que faltar ("Ana", "15h"...).


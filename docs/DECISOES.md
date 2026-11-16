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

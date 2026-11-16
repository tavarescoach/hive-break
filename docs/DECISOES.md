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

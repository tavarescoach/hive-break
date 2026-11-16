# Hive Break — Especificação do MVP

Nov 14, 2026 · @Luan Tavares

## 1. Visão e escopo do MVP

O MVP do Hive Break é um web app mobile first (PWA) que usa a câmera frontal do celular para validar desafios de exercício de até 5 minutos. Os desafios se agrupam em níveis de 8 a 12 (uma sessão completa de 40 a 60 minutos), e o usuário escolhe fazer só um desafio no dia ou o nível inteiro.

**Proposta em uma frase:** "Um desafio de 5 minutos por dia, ou o treino completo quando der, com um treinador na câmera que conta, corrige e pontua cada repetição."

**Público inicial:** adultos de 18 a 60 anos, sedentários ou pouco ativos, que querem começar ou manter o hábito em casa, sem gastar com equipamento no início. Primeiro grupo de teste: alunos e contatos do TTC, que convidam outras pessoas.

### Hipóteses que o MVP precisa validar

1. **Técnica:** a câmera frontal conta repetições com erro de no máximo 1 rep a cada 10, numa sala comum, para os exercícios do catálogo.
2. **Uso:** o usuário consegue posicionar o celular e começar o primeiro desafio em menos de 90 segundos.
3. **Hábito:** pelo menos 25% dos usuários que terminam o onboarding fazem desafios em 3 dias ou mais na primeira semana.
4. **Motivação:** score de qualidade e liga fazem o usuário repetir desafios para melhorar a nota.
5. **Crescimento:** os usuários convidam amigos. Meta: pelo menos 30% dos ativos enviam 1 convite ou mais e o coeficiente viral (K) fica acima de 0,3 no teste fechado.

### Dentro do escopo

- Login com Google e perfil com dados pessoais, objetivo, equipamento e triagem de segurança
- Teste de nivelamento (4 movimentos)
- 1 trilha com 8 níveis de 8 a 12 desafios cada
- Modalidades: aquecimento, alongamento, mobilidade, CORE, força, condicionamento, HIIT, equilíbrio, precisão, yoga, volta à calma e respiração/meditação
- 19 exercícios no catálogo, com detecção pela câmera frontal
- Equipamento progressivo: níveis 1 a 4 sem equipamento; tapete e cabo de vassoura nos níveis seguintes, com aviso antecipado
- Tela de execução com KPIs ao vivo, número da série e repetições feitas/total
- Música de fundo livre de direitos autorais, com opção sem música
- Score por desafio, estrelas por nível, XP, ofensiva diária, liga semanal
- Convites com recompensa para quem convida e para o convidado, e ranking entre amigos
- Histórico simples de evolução

### Fora do escopo (próximas versões)

- Montador de níveis personalizados pelo usuário
- Halteres, elásticos e outros equipamentos de compra
- Feed social, desafios diretos entre amigos e compartilhamento em redes
- Painel do treinador para o TTC
- Pagamento e assinatura
- App nativo (iOS/Android)
- Integração com relógios e Apple Health / Google Fit

## 2. Premissas e decisões

As premissas abaixo são o padrão adotado nesta especificação. As marcadas como "decidido" foram confirmadas pelo Luan em 14/11/2026; as demais podem ser trocadas antes da construção.

| Tema | Premissa adotada | Status |
| --- | --- | --- |
| Estrutura do jogo | Trilha → Nível (8 a 12 desafios, 40 a 60 min) → Desafio (até 5 min). O usuário faz 1 desafio ou o nível inteiro, como quiser | Decidido |
| Níveis personalizados | Fora do MVP; entram na versão 2 com regras de segurança e sem valer para a liga | Decidido |
| Convites | Dentro do MVP: link de convite, recompensa para os dois lados, ranking entre amigos | Decidido |
| Câmera | Somente a frontal (a pessoa precisa ver a tela). Exercícios de vista lateral pedem que a pessoa fique de lado para o celular | Decidido |
| Custo para o usuário | Início sem custo e sem equipamento; equipamento entra aos poucos, com aviso antecipado | Decidido |
| Música | Faixas livres de direitos autorais (royalty-free ou CC0) ou sem música, à escolha do usuário | Decidido |
| Nome do produto | Hive Break | Decidido |
| Modelo de negócio | Gratuito no MVP, teste fechado com alunos e contatos do TTC e quem eles convidarem | Aberto |
| Plataforma | PWA no navegador do celular, instalável na tela inicial | Aberto |
| Idioma | Português do Brasil | Aberto |
| Processamento de vídeo | 100% no aparelho; nenhum vídeo sai do celular | Aberto |
| Detecção de pose | MediaPipe Pose Landmarker (Tasks Vision, web) | Aberto |
| Backend | Supabase (Auth Google, Postgres, RLS, Edge Functions) | Aberto |
| Front-end | Next.js + TypeScript + Tailwind, deploy na Vercel | Aberto |
| Idade mínima | 18 anos | Aberto |

**Perguntas para o Luan responder antes do build:**

- [ ] Nome definido: Hive Break (15/11/2026).
- [ ] O MVP leva a marca TTC ou é uma marca própria?
- [ ] Quem revisa tecnicamente os critérios de cada exercício (amplitude mínima, erros)?
- [ ] Quantos testadores no grupo inicial e por quanto tempo (sugestão: 30 pessoas, 4 semanas, cada uma com convites liberados)?
- [ ] Quais faixas de música usar (biblioteca royalty-free paga ou faixas CC0 gratuitas)?

## 3. Jornada do usuário

A jornada tem três partes: o primeiro acesso, que precisa levar o usuário ao primeiro desafio concluído em até 5 minutos; o ciclo diário, em que ele escolhe entre 1 desafio de 5 minutos ou o nível completo; e o ciclo de convite, que traz novos usuários.

### 3.1 Primeiro acesso

1. **Landing page.** O usuário chega por link, QR code ou convite. Se veio por convite, a página mostra "Fulano te convidou" com a foto e a ofensiva de quem convidou. Vê a proposta, um vídeo curto da câmera contando repetições e o botão "Começar".
2. **Login com Google.** Um toque. Primeiro acesso cria a conta e registra quem convidou; acessos seguintes vão direto para a trilha.
3. **Aceite de termos e privacidade.** Tela curta explicando que a câmera é processada no aparelho e nenhum vídeo é gravado ou enviado. Aceite de termos e de dados de saúde (LGPD).
4. **Perfil em etapas (uma pergunta por tela, estilo Duolingo).** Apelido, data de nascimento, sexo, altura, peso, objetivo, nível de atividade atual, dias por semana, equipamento que já tem em casa (nenhum, tapete, cabo de vassoura). Barra de progresso no topo.
5. **Triagem de segurança (PAR-Q+ simplificado).** 7 perguntas de sim ou não. Qualquer "sim" mostra recomendação de liberar com médico e limita o usuário a desafios de baixa intensidade (mobilidade, alongamento, yoga, equilíbrio, respiração) até confirmar liberação.
6. **Meta diária.** Escolha entre 1, 2 ou 3 desafios por dia (5, 10 ou 15 minutos). O nível completo fica sempre disponível como opção.
7. **Configuração da câmera frontal.** Pedido de permissão, guia visual de como apoiar o celular (em pé num móvel ou encostado na parede, a 2 a 3 metros, corpo inteiro visível) e checagem ao vivo: o contorno do corpo fica verde quando o enquadramento está bom.
8. **Escolha de música.** 3 estilos de faixa livre de direitos (ex.: eletrônica, lo-fi, batida acelerada) ou "sem música". Pode ser trocado a qualquer momento.
9. **Teste de nivelamento (cerca de 4 minutos).** 4 movimentos: agachamento máximo em 40 s, polichinelo máximo em 30 s, apoio em uma perna pelo máximo de tempo (limite de 45 s por lado) e elevação de braços em Y (amplitude de ombro). Gera a linha de base e define o nível de dificuldade inicial.
   - Pode ser pulado; nesse caso a dificuldade vem do questionário e o teste reaparece depois do 3º desafio.
10. **Resultado do nivelamento.** Celebração com os números da linha de base e o primeiro XP. Botão "Ver minha trilha".
11. **Trilha.** O usuário cai no Nível 1 com o primeiro desafio destacado. Oferta de instalar na tela inicial e de ativar lembrete.
12. **Primeiro convite.** Depois do primeiro desafio concluído, um cartão oferece: "Treine com um amigo. Se ele completar o 1º desafio, os dois ganham um protetor de ofensiva."

### 3.2 Ciclo diário

1. **Lembrete** no horário escolhido: "Sua ofensiva de 6 dias está esperando. 5 minutos?"
2. **Trilha:** abre no nível atual, mostra os desafios do nível (concluídos, próximo, bloqueados), ofensiva, XP do dia e posição na liga.
3. **Escolha do treino de hoje:**
   - **"Só um desafio" (até 5 min):** abre o próximo desafio do nível.
   - **"Nível completo" (40 a 60 min):** encadeia todos os desafios que faltam no nível, na ordem certa (aquecimento primeiro, volta à calma e respiração no fim), com 30 a 60 s de transição entre eles.
4. **Pré-desafio:** exercícios, duração, intensidade, equipamento, botão "Começar". Opção "versão mais leve".
5. **Aquecimento rápido automático:** se o usuário escolher um desafio de força, HIIT ou condicionamento sem ter aquecido no dia, o app insere 60 s de aquecimento antes.
6. **Checagem de enquadramento** (5 a 10 s, pulada se o corpo já está visível).
7. **Execução:** tela com câmera, esqueleto, série atual ("Série 2 de 3"), repetições feitas/total ("8/12"), timer, KPIs ao vivo, feedback de voz e música. Descanso entre séries com prévia da próxima.
8. **Botão "senti dor"** sempre visível: pausa, pergunta onde dói e oferece trocar por alternativa ou encerrar sem perder a ofensiva.
9. **Resultado do desafio:** score (0 a 100), estrelas, repetições válidas, KPIs, XP, comparação com a última vez, percepção de esforço (1 a 10).
10. **Volta à trilha** com o próximo desafio liberado. Quando o nível inteiro é concluído: tela de nível concluído, estrelas do nível, aviso de equipamento do próximo nível (se houver) e cartão de convite.

### 3.3 Equipamento progressivo

1. No perfil, o usuário informa o que já tem em casa.
2. Quando faltam 2 níveis para um nível que pede equipamento que ele não marcou, a trilha mostra um aviso: "No Nível 5 você vai precisar de um tapete. Pode ser uma toalha grossa ou um colchonete."
3. O aviso repete na conclusão do nível anterior, com botão "Já tenho".
4. Se ele chegar ao nível sem o equipamento, os desafios que pedem o item são trocados por alternativas sem equipamento. Ele pode concluir o nível, mas com no máximo 2 estrelas nesses desafios.

### 3.4 Ciclo de convite

1. **Momentos de convite:** depois do 1º desafio, ao concluir um nível, ao subir de divisão na liga, ao bater um recorde pessoal e na aba Amigos.
2. **Envio:** link pessoal com código, compartilhado pelo menu nativo do celular (WhatsApp, Instagram, SMS). A mensagem padrão é editável: "Estou treinando 5 minutos por dia no Hive Break. Bora junto? \[link\]"
3. **Chegada do convidado:** landing com o nome de quem convidou, depois o mesmo primeiro acesso.
4. **Ativação:** quando o convidado conclui o 1º desafio, os dois ganham 1 protetor de ofensiva e viram amigos automaticamente. Quem convidou recebe notificação.
5. **Ranking entre amigos:** a aba Amigos mostra a semana dos amigos (XP, ofensiva, nível), além da liga pública.
6. **Limite:** recompensa por até 10 convidados ativados por mês por usuário.

### 3.5 Situações de exceção

- **Câmera negada ou sem suporte:** modo manual, em que o usuário confirma as repetições. Ganha 50% do XP e não pontua na liga.
- **Perda de detecção no meio do desafio:** pausa automática com aviso "não estou te vendo" e retomada quando o corpo volta ao quadro.
- **Nível completo interrompido:** os desafios já feitos ficam salvos; o resto continua disponível como desafios avulsos.
- **Ofensiva quebrada:** mensagem acolhedora e oferta de recomeçar com um desafio de 3 minutos.
- **Usuário parado por 7 dias:** ao voltar, sugere refazer o nivelamento.

## 4. Mapa de telas

O MVP tem 20 telas. A navegação principal usa uma barra inferior com 4 abas: Trilha, Liga, Amigos e Perfil.

| # | Tela | Rota | Conteúdo principal | Ação principal |
| --- | --- | --- | --- | --- |
| 1 | Landing | / | Proposta, vídeo curto, benefícios | Começar |
| 2 | Landing de convite | /c/\[codigo\] | Nome, foto e ofensiva de quem convidou | Aceitar convite |
| 3 | Login | /entrar | Botão Google | Entrar com Google |
| 4 | Termos e privacidade | /onboarding/termos | Resumo de privacidade da câmera, aceites LGPD | Aceitar |
| 5 | Perfil em etapas | /onboarding/perfil/\[etapa\] | Uma pergunta por tela, inclusive equipamento em casa | Continuar |
| 6 | Triagem de segurança | /onboarding/triagem | 7 perguntas sim/não | Continuar |
| 7 | Meta diária | /onboarding/meta | 1, 2 ou 3 desafios por dia | Definir meta |
| 8 | Configuração da câmera | /camera | Permissão, guia de posicionamento, checagem ao vivo | Estou pronto |
| 9 | Escolha de música | /onboarding/musica | 3 estilos com prévia de 10 s, opção sem música | Escolher |
| 10 | Nivelamento e resultado | /nivelamento | 4 testes em sequência, depois linha de base e XP | Iniciar / Pular / Ver trilha |
| 11 | Trilha (home) | /trilha | Níveis, desafios do nível atual, ofensiva, XP do dia, aviso de equipamento | Só um desafio / Nível completo |
| 12 | Pré-desafio | /desafio/\[id\] | Exercícios, duração, intensidade, equipamento | Começar |
| 13 | Execução | /desafio/\[id\]/jogar | Câmera, esqueleto, série, reps feitas/total, timer, KPIs ao vivo, música (ver seção 8.5) | Pausar / Senti dor |
| 14 | Transição do nível completo | /nivel/\[id\]/sessao | Desafio concluído, próximo desafio, contagem de 30 a 60 s, progresso "4 de 10" | Seguir / Encerrar por hoje |
| 15 | Resultado do desafio | /desafio/\[id\]/resultado | Score, estrelas, KPIs, XP, esforço percebido | Continuar |
| 16 | Nível concluído | /nivel/\[id\]/concluido | Estrelas do nível, totais, próximo nível, aviso de equipamento, cartão de convite | Convidar / Continuar |
| 17 | Liga | /liga | Ranking semanal de 30 pessoas, zonas de subida e descida | — |
| 18 | Amigos e convites | /amigos | Ranking da semana entre amigos, link de convite, convites enviados e ativados, protetores ganhos | Convidar |
| 19 | Perfil e evolução | /perfil | Dados, estatísticas, gráfico de evolução, conquistas, equipamentos | Editar |
| 20 | Configurações | /perfil/config | Lembrete, música e volume, voz, exportar e excluir dados | Salvar |

**Componentes reutilizáveis:** barra de ofensiva, chip de XP, card de desafio (bloqueado, disponível, concluído com estrelas), card de nível com equipamento, overlay de câmera com esqueleto, contador de repetições feitas/total, indicador de série, anel de timer, painel de KPIs ao vivo, controle de música, modal de dor, cartão de convite, toast de conquista.

## 5. Dados do perfil

O perfil coleta só o que muda a experiência: personalização da trilha, equipamento, segurança e justiça no ranking. Altura, peso e triagem são dados de saúde e ficam protegidos por RLS, sem aparecer para outros usuários.

| Campo | Tipo / valores | Obrigatório | Para que serve |
| --- | --- | --- | --- |
| Nome e e-mail | vem do Google | Sim | Conta e contato |
| Foto | vem do Google | Não | Avatar na liga, nos amigos e na landing de convite |
| Apelido | texto, 3 a 20 caracteres | Sim | Nome público na liga e nos convites |
| Data de nascimento | data | Sim | Idade mínima, faixa etária |
| Sexo | feminino, masculino, prefiro não dizer | Sim | Referências de desempenho |
| Altura | cm, 120 a 230 | Sim | Calibração de amplitude, IMC |
| Peso | kg, 30 a 250 | Sim | Gasto calórico estimado |
| Objetivo principal | emagrecer, ganhar força, mobilidade, condicionamento, saúde geral | Sim | Peso das modalidades nos níveis |
| Nível de atividade | sedentário, pouco ativo (1 a 2x/semana), ativo (3x ou mais) | Sim | Dificuldade inicial se pular o nivelamento |
| Dias por semana | 2 a 7 | Sim | Ritmo de lembretes |
| Meta diária | 1, 2 ou 3 desafios | Sim | Meta de XP diária |
| Equipamento em casa | nenhum, tapete, cabo de vassoura (múltipla escolha) | Sim | Avisos e troca de desafios |
| Música | estilo 1, 2, 3 ou sem música; volume da música e da voz | Sim | Áudio da execução |
| Horário do lembrete | hora | Não | Notificação |
| Limitações | joelho, ombro, lombar, punho, nenhuma | Não | Troca automática de exercícios |
| Triagem PAR-Q+ | 7 respostas sim/não + data | Sim | Liberação de intensidade |
| Aceites | termos, privacidade, dados de saúde, com data e versão | Sim | LGPD |
| Código de convite | gerado, 6 caracteres | Automático | Link pessoal de convite |
| Convidado por | id de outro usuário | Automático | Recompensa e métrica viral |

**Dados calculados a partir do perfil:** idade, faixa etária (18-29, 30-39, 40-49, 50-60), IMC, dificuldade atual (1 a 10), liberado para alta intensidade (sim/não).

**Linha de base do nivelamento:** agachamentos em 40 s, polichinelos em 30 s, tempo de apoio em uma perna (por lado), amplitude de ombro na elevação em Y (graus). Refeita a cada 4 semanas para mostrar evolução.

## 6. Estrutura da campanha

A campanha do MVP é uma trilha com 8 níveis. Cada nível é uma sessão completa de 8 a 12 desafios (40 a 60 minutos) que vai do aquecimento à respiração. Cada desafio dura até 5 minutos e pode ser feito sozinho.

**Hierarquia:** Trilha → Nível (sessão completa) → Desafio (até 5 min) → Bloco → Exercício.

### 6.1 Os 8 níveis do MVP

| Nível | Tema | Desafios | Duração total | Equipamento | Aviso de equipamento aparece |
| --- | --- | --- | --- | --- | --- |
| 1 | Primeiros passos | 8 | \~40 min | Nenhum | — |
| 2 | Base de movimento | 8 | \~40 min | Nenhum | — |
| 3 | Equilíbrio e controle | 10 | \~45 min | Nenhum | No nível 3 (para o nível 5) |
| 4 | Ritmo | 10 | \~45 min | Nenhum | Ao concluir o nível 4 |
| 5 | Chão firme | 10 | \~50 min | Tapete (ou toalha grossa) | No nível 5 (para o nível 7) |
| 6 | Potência | 12 | \~55 min | Tapete | Ao concluir o nível 6 |
| 7 | Amplitude total | 12 | \~55 min | Tapete + cabo de vassoura | — |
| 8 | Desafio final | 12 | \~60 min | Tapete + cabo de vassoura | Prévia do próximo pacote (halter na versão 2) |

### 6.2 Modelo de nível

Todo nível segue a mesma ordem fisiológica. Os níveis de 8 desafios tiram as posições marcadas com \*; os de 12 acrescentam as marcadas com †.

| Ordem | Desafio | Modalidade | Duração |
| --- | --- | --- | --- |
| 1 | Aquecimento | Aquecimento | 3 a 4 min |
| 2 | Mobilidade articular | Mobilidade | 4 a 5 min |
| 3 | Equilíbrio \* | Equilíbrio | 3 a 4 min |
| 4 | Precisão † | Precisão e coordenação | 3 a 4 min |
| 5 | Força de pernas | Força | 5 min |
| 6 | Força de tronco e braços \* | Força | 5 min |
| 7 | CORE | CORE | 4 a 5 min |
| 8 | Condicionamento | Condicionamento | 5 min |
| 9 | HIIT | HIIT | 4 a 5 min |
| 10 | Mobilidade dinâmica † | Mobilidade | 4 a 5 min |
| 11 | Yoga e alongamento | Yoga / alongamento estático | 5 min |
| 12 | Volta à calma e respiração | Volta à calma / meditação | 4 a 5 min |

### 6.3 Como o usuário percorre o nível

- **"Só um desafio":** abre o próximo desafio não concluído, na ordem do nível. O usuário também pode tocar em qualquer desafio já liberado.
- **"Nível completo":** encadeia os desafios que faltam, na ordem, com transição de 30 a 60 s entre eles. Pode parar a qualquer momento; o que foi feito fica salvo.
- **Aquecimento automático:** um desafio de força, condicionamento ou HIIT feito sem aquecimento nas últimas 2 horas recebe 60 s de aquecimento antes.
- **Conclusão do nível:** todos os desafios com pelo menos 1 estrela. As estrelas do nível são a média arredondada para baixo.
- **Desbloqueio:** o nível seguinte libera quando o atual é concluído.

### 6.4 Formatos de bloco

- **Repetições:** X repetições válidas por série (ex.: 3 séries de 10 agachamentos).
- **Por tempo (AMRAP):** máximo de repetições válidas em N segundos.
- **Intervalado (HIIT / Tabata):** N rodadas de trabalho e descanso.
- **Isometria:** segurar a posição por N segundos com alinhamento correto.
- **Mobilidade guiada:** movimento lento com amplitude-alvo, N repetições controladas.
- **Postura (yoga e alongamento):** chegar à forma-alvo e manter por N segundos.
- **Equilíbrio:** manter a posição pelo máximo de tempo, até um limite, com oscilação medida.
- **Precisão:** tocar alvos que aparecem na tela com mão ou pé.
- **Respiração guiada:** áudio e animação de respiração; a câmera só confere se a pessoa está parada.

### 6.5 Progressão de dificuldade

Além do nível da trilha, cada usuário tem uma **dificuldade pessoal de 1 a 10** que ajusta repetições, tempo de trabalho, descanso e variação dos exercícios.

- **Sobe 1 ponto** depois de 3 desafios de força, condicionamento ou HIIT seguidos com 3 estrelas e esforço percebido até 7.
- **Mantém** com 2 estrelas ou esforço entre 8 e 9.
- **Desce 1 ponto** com 1 estrela em 2 desafios seguidos ou esforço 10.
- Dias de recuperação: depois de 2 dias seguidos com HIIT, a trilha sugere desafios de mobilidade, yoga ou respiração, que contam para a ofensiva.
- Usuário não liberado na triagem fica limitado à dificuldade 3 e não recebe desafios de HIIT.

## 7. Catálogo de exercícios do MVP

O MVP usa 19 exercícios: 10 de base (tabela 7.1) e 9 de yoga, equilíbrio, precisão, respiração e cabo de vassoura (tabela 7.2). Todos são lidos pela câmera frontal; nos de vista lateral, a pessoa fica de lado para o celular. Os ângulos são valores iniciais, a calibrar no teste técnico com pessoas reais.

Exercícios de chão podem ser feitos sem tapete nos níveis 1 a 4; o tapete passa a ser pedido no nível 5, quando o volume de chão aumenta.

### 7.1 Exercícios de base

**Convenção:** ângulo do joelho = quadril–joelho–tornozelo; do quadril = ombro–quadril–joelho; do cotovelo = ombro–cotovelo–punho; alinhamento do corpo = ombro–quadril–tornozelo. 180° = segmento reto.

| Exercício | Modalidade | Câmera | Validação da repetição | KPIs | Erros detectados |
| --- | --- | --- | --- | --- | --- |
| Agachamento livre | Força | Frontal, corpo inteiro | Em pé (joelho > 160°) → fundo (joelho < 100°) → em pé | Reps válidas, profundidade média, tempo de descida e subida | Joelho para dentro (distância entre joelhos < 80% da distância entre tornozelos); amplitude curta |
| Afundo alternado (para trás) | Força | 45° ou lateral | Joelho da frente < 100° e joelho de trás próximo do chão, alternando lados | Reps por lado, simetria esquerda/direita, profundidade | Tronco inclinado > 30°; amplitude curta |
| Flexão de braço (ou com joelhos) | Força | Lateral, celular no chão | Cotovelo > 150° → < 90° → > 150°, com corpo alinhado | Reps válidas, profundidade, cadência | Quadril caído ou alto (alinhamento fora de 160° a 200°) |
| Ponte de glúteo | Força / ativação | Lateral, celular no chão | Quadril < 130° → > 165° (extensão completa) → volta | Reps, extensão máxima, tempo no topo | Extensão incompleta |
| Prancha alta ou de antebraço | CORE | Lateral, celular no chão | Isometria: tempo com alinhamento entre 165° e 195° | Tempo válido, estabilidade (oscilação do quadril), % do tempo alinhado | Quadril caído; quadril alto |
| Polichinelo | Cardio | Frontal | Fechado (mãos abaixo dos ombros, pés juntos) → aberto (mãos acima da cabeça, pés > 1,5x largura dos ombros) → fechado | Reps, cadência (reps/min), regularidade do ritmo | Braços não sobem acima da cabeça |
| Skipping (elevação de joelhos) | Cardio / condicionamento | Frontal | Joelho acima da linha do quadril, alternando | Reps por lado, cadência, altura média do joelho | Joelho abaixo da linha do quadril |
| Mountain climber | Condicionamento / CORE | Lateral, celular no chão | Quadril < 90° na perna que avança, alternando, com tronco em prancha | Reps, cadência, alinhamento | Quadril muito alto |
| Elevação de braços em Y | Mobilidade | Frontal | Ombro (quadril–ombro–cotovelo) de < 30° → > 160° com cotovelos estendidos | Reps controladas, amplitude máxima de ombro, simetria | Cotovelo dobrado; compensação com tronco |
| Alongamento de posterior em pé | Alongamento estático | Lateral | Isometria: quadril < 110° com joelhos > 160° | Tempo na posição, amplitude máxima (ângulo de quadril) | Joelhos dobrados |

### 7.2 Yoga, equilíbrio, precisão, respiração e cabo de vassoura

| Exercício | Modalidade | Câmera | Validação | KPIs | Erros detectados | Equipamento |
| --- | --- | --- | --- | --- | --- | --- |
| Marcha estacionária com braços | Aquecimento | Frontal | Joelho sobe acima da metade da distância entre joelho em pé e quadril, alternando, com braço oposto | Reps, cadência | Joelho baixo | Nenhum |
| Guerreiro II | Yoga | Frontal | Joelho da frente entre 90° e 115°, braços na horizontal (ombro entre 75° e 105°), mantido N s | Tempo na forma, semelhança com a pose-modelo (0 a 1) | Joelho para dentro; braços caindo | Nenhum |
| Postura da árvore | Yoga / equilíbrio | Frontal | Um pé fora do chão, apoiado na perna oposta (tornozelo livre acima do tornozelo de apoio e perto da linha média), mantido N s | Tempo por lado, oscilação do quadril, simetria | Pé tocou o chão | Nenhum |
| Cachorro olhando para baixo | Yoga | Lateral, no chão | Quadril é o ponto mais alto, ângulo de quadril entre 60° e 100°, joelhos > 150°, cotovelos > 160° | Tempo na forma, alinhamento | Joelhos dobrados; cotovelos dobrados | Tapete |
| Apoio em uma perna | Equilíbrio | Frontal | Um pé fora do chão, mantido até o limite de tempo | Tempo por lado, oscilação, simetria | Pé tocou o chão; braços buscando apoio | Nenhum |
| Toque nos alvos | Precisão e coordenação | Frontal | Alvos aparecem na tela em posições ao alcance (calculadas pelo tamanho do corpo); acerto quando o punho ou o tornozelo entra no círculo em até 2 s | Acertos, tempo de reação médio, precisão (%) | Alvo perdido | Nenhum |
| Respiração guiada | Volta à calma / meditação | Frontal, sentado ou em pé | Áudio guia o ritmo (ex.: 4 s inspira, 6 s expira); a câmera confere se o corpo está parado | Tempo concluído, % do tempo parado | Saiu do quadro | Nenhum |
| Agachamento com bastão acima da cabeça | Mobilidade | Frontal | Punhos acima da cabeça (ombro > 160°) durante todo o agachamento, joelho < 100° no fundo | Reps, profundidade, % do tempo com braços no alto | Braços caem para a frente | Cabo de vassoura |
| Bom-dia com bastão | Força / mobilidade de posterior | Lateral | Bastão nas costas; quadril de > 165° para < 110° com joelhos > 150° | Reps, amplitude de quadril | Joelhos dobrados demais | Cabo de vassoura |

O cabo de vassoura não é detectado pela câmera. Ele é deduzido pela posição dos punhos, e o uso real depende da palavra do usuário.

**Regras gerais de detecção:**

- Um ponto só entra no cálculo com visibilidade acima de 0,6 (dado do MediaPipe). Abaixo disso o frame é ignorado.
- Ângulos passam por suavização (média móvel de 5 frames ou filtro One Euro) para não contar tremor como repetição.
- Cada fase precisa durar pelo menos 150 ms, e uma repetição completa pelo menos 400 ms (antifraude básico).
- Repetição com amplitude abaixo do mínimo é contada como "parcial": aparece no feedback, não soma no score.
- Cada exercício tem uma variação mais fácil (ex.: flexão com joelhos) e uma alternativa para quem marcou limitação.

**Para a versão 2:** burpee, agachamento com salto, prancha lateral, superman, abdominal remador, rotação torácica, mais posturas de yoga, e exercícios com halter e elástico.

## 8. Motor de análise de movimento e KPIs

O motor roda inteiro no navegador e transforma o vídeo da câmera em eventos (repetição válida, parcial, erro de execução) e, no fim de cada bloco, em KPIs. Os exercícios são definidos como dados (JSON), não como código, para que um exercício novo não exija programação.

### 8.1 Fluxo de processamento

1. **Captura:** `getUserMedia`, somente câmera frontal (facingMode "user"), imagem espelhada na tela, 640x480, 30 fps.
2. **Pose:** MediaPipe Pose Landmarker (modelo *lite* por padrão, *full* em aparelhos fortes), 33 pontos com coordenadas e visibilidade.
3. **Filtro:** descarta pontos com visibilidade < 0,6 e suaviza coordenadas (One Euro).
4. **Medidas:** calcula os ângulos e distâncias que o exercício pede.
5. **Máquina de estados:** cada exercício tem fases (ex.: em pé → descendo → fundo → subindo). Transições acontecem por limiares de ângulo com histerese de 5°.
6. **Eventos:** repetição válida, repetição parcial, erro de execução, corpo fora do quadro.
7. **Feedback:** contador na tela, som de confirmação e frase de voz (Web Speech API) no máximo a cada 4 s.
8. **Agregação:** ao fim do bloco, calcula os KPIs e envia só os números ao servidor.

### 8.2 Exemplo de definição de exercício

```json
{
  "id": "agachamento_livre",
  "modalidade": "forca",
  "camera": "frontal",
  "pontos_obrigatorios": ["quadril_e", "quadril_d", "joelho_e", "joelho_d", "tornozelo_e", "tornozelo_d"],
  "medida_principal": { "tipo": "angulo", "pontos": ["quadril", "joelho", "tornozelo"], "lado": "media" },
  "fases": [
    { "nome": "topo", "condicao": "medida > 160" },
    { "nome": "fundo", "condicao": "medida < 100" }
  ],
  "repeticao": ["topo", "fundo", "topo"],
  "parcial_se": "min_medida entre 100 e 120",
  "duracao_minima_ms": 400,
  "erros": [
    { "id": "valgo", "condicao": "dist(joelhos) < 0.8 * dist(tornozelos)", "fase": "fundo", "feedback": "Joelhos para fora" }
  ],
  "kpis": ["reps_validas", "reps_parciais", "amplitude_media", "tempo_excentrico", "tempo_concentrico", "cadencia"],
  "variacao_facil": "agachamento_parcial_cadeira",
  "alternativas": { "joelho": "ponte_gluteo" }
}
```

### 8.3 KPIs calculados

| KPI | Definição | Unidade | Usado em |
| --- | --- | --- | --- |
| Reps válidas | Repetições que completaram todas as fases com amplitude mínima | contagem | Força, cardio, condicionamento |
| Reps parciais | Repetições sem amplitude mínima | contagem | Todos com repetição |
| Amplitude média | Média do ângulo extremo atingido, normalizada de 0 a 1 entre o mínimo aceito e o ideal | 0 a 1 | Força, mobilidade |
| Cadência | Reps válidas por minuto de trabalho | reps/min | Cardio, condicionamento |
| Regularidade | 1 menos o coeficiente de variação do tempo entre reps | 0 a 1 | Cardio, HIIT |
| Tempo sob tensão | Soma das fases excêntrica e concêntrica | s | Força |
| Tempo válido | Tempo em isometria dentro da faixa de alinhamento | s | CORE, alongamento |
| Estabilidade | 1 menos a oscilação do ponto de controle (ex.: quadril) normalizada | 0 a 1 | CORE |
| Simetria | Menor lado dividido pelo maior lado (reps ou amplitude) | 0 a 1 | Afundo, skipping, mobilidade |
| Índice técnico | 1 menos a proporção de reps com erro de execução | 0 a 1 | Todos |
| Fadiga | Queda de amplitude ou cadência entre o primeiro e o último terço do bloco | % | HIIT, AMRAP |

### 8.4 Metas de desempenho técnico

- Pelo menos 20 fps de análise num Android intermediário (ex.: Galaxy A35) e num iPhone 12.
- Primeira detecção em até 3 s depois de abrir a câmera (modelo em cache depois do primeiro uso).
- Erro de contagem de no máximo 1 rep a cada 10, medido contra contagem manual em vídeo.
- Se o aparelho ficar abaixo de 12 fps, trocar para o modelo *lite* e reduzir resolução; se continuar, oferecer modo manual.

### 8.5 Tela de execução

A tela de execução precisa ser lida a 2 ou 3 metros de distância: números grandes, poucos elementos e alto contraste sobre a imagem da câmera.

| Zona | Conteúdo | Exemplo |
| --- | --- | --- |
| Topo esquerdo | Nome do exercício e posição no nível | "Agachamento · Desafio 5 de 10" |
| Topo direito | Controle de música (tocar, pular faixa, mudo) e pausa | — |
| Centro | Imagem da câmera espelhada com esqueleto; pontos ficam vermelhos quando há erro de execução | — |
| Centro, grande | Repetições feitas / total (ou tempo válido / meta, nas isometrias) | "8/12" ou "0:22/0:30" |
| Abaixo do contador | Número ordinal da série | "2ª série de 3" |
| Faixa inferior | 2 ou 3 KPIs ao vivo do exercício, com cor (verde bom, amarelo atenção) | Profundidade 92% · Ritmo 24 reps/min · Técnica 100% |
| Anel em volta do contador | Tempo restante do bloco ou do intervalo | — |
| Canto inferior | Botão "senti dor" | — |
| Faixa de aviso (temporária) | Feedback de execução, junto com a voz | "Joelhos para fora" |

**Descanso entre séries:** contagem regressiva grande, próxima série ("3ª série: 12 reps"), resumo da série anterior (reps válidas e qualidade) e música com volume reduzido.

**Áudio:** música de fundo livre de direitos ou silêncio, conforme o perfil. A música baixa automaticamente quando a voz fala. Som curto de confirmação a cada repetição válida e som diferente para parcial.

## 9. Pontuação, XP, ligas e convites

O jogo separa três moedas: o **score** mede a qualidade de um desafio, o **XP** recompensa constância e os **pontos de liga** fazem o ranking semanal. Como as metas de cada desafio vêm da dificuldade pessoal do usuário, o score já é relativo: um iniciante que cumpre a meta dele pontua como um atleta que cumpre a dele. A ofensiva está na seção 10.

### 9.1 Score do desafio (0 a 100)

```latex
\text{Score} = 100 \times \left(0{,}4 \cdot \text{Execução} + 0{,}4 \cdot \text{Qualidade} + 0{,}2 \cdot \text{Constância}\right)
```

- **Execução** (0 a 1): reps válidas, tempo válido ou acertos divididos pela meta, limitado a 1,2 (até 20% de bônus por passar da meta).
- **Qualidade** (0 a 1): média de amplitude, índice técnico e, quando houver, estabilidade, simetria, semelhança com a pose ou precisão.
- **Constância** (0 a 1): regularidade do ritmo e proporção do tempo de trabalho realmente ativo.
- O score do desafio é a média dos blocos, ponderada pela duração. O resultado final é limitado a 100.
- **Respiração guiada** não tem score: vale como concluída (3 estrelas) se a pessoa ficar parada em pelo menos 70% do tempo.

**Estrelas do desafio:** 1 estrela a partir de 40, 2 a partir de 70, 3 a partir de 90. **Estrelas do nível:** média das estrelas dos desafios, arredondada para baixo.

### 9.2 XP

| Evento | XP |
| --- | --- |
| Desafio concluído | 10 |
| Cada estrela acima de 1 | +5 |
| Primeiro desafio do dia | +5 |
| Nível completo numa única sessão | +50 |
| Nível concluído (em qualquer número de dias) | +30 |
| Nivelamento concluído | 30 |
| Convidado ativado | 20 |
| Modo manual (sem câmera) | 50% do valor |

A meta diária de XP é 10 vezes o número de desafios por dia escolhido no perfil.

### 9.3 Liga semanal

- **Grupos de 30 pessoas** formados toda segunda-feira, agrupando usuários da mesma divisão e com dificuldade parecida (diferença de até 2 pontos).
- **Pontos de liga** = soma do score dos desafios da semana, contando só a melhor tentativa de cada desafio por dia e no máximo 12 desafios por dia (um nível completo). Isso premia qualidade e constância, não repetição sem fim do mesmo desafio.
- Respiração guiada e modo manual não dão pontos de liga.
- **Divisões do MVP:** Bronze, Prata, Ouro, Safira, Diamante.
- **Fim da semana (domingo, 23h59):** os 7 primeiros sobem de divisão, os 5 últimos descem (Bronze não desce). Quem fez 0 pontos não entra no grupo da semana seguinte até fazer um desafio.

### 9.4 Convites e amigos

- Cada usuário tem um link pessoal (`/c/[codigo]`) compartilhável pelo menu nativo do celular.
- **Ativação:** o convite conta quando o convidado conclui o 1º desafio com câmera em até 14 dias depois do cadastro.
- **Recompensa na ativação:** 1 protetor de ofensiva para cada um e 20 XP para quem convidou. Limite de 10 ativações recompensadas por mês.
- Convidado e quem convidou viram amigos automaticamente. Também dá para adicionar amigos por código.
- **Ranking entre amigos:** XP da semana, ofensiva e nível atual de cada amigo, na aba Amigos.
- **Ofensiva com amigo e cutucada:** ver seção 10.2.
- **Antifraude:** convidado com o mesmo aparelho ou e-mail descartável não gera recompensa.

### 9.5 Regras antifraude

- Repetição mais rápida que o limite humano do exercício (ex.: mais de 2 agachamentos por segundo) não conta.
- Mais de 30% do desafio com o corpo fora do quadro invalida o desafio para a liga.
- O servidor recalcula o score a partir dos KPIs enviados e recusa valores impossíveis.
- Score 100 em 5 desafios seguidos marca a conta para revisão manual.

### 9.6 Conquistas do MVP

Primeiro desafio · Primeiro nível completo numa sessão · Ofensiva de 7, 30 e 100 dias · Semana perfeita · Nível 8 concluído · 100 agachamentos válidos · Árvore de 60 s em cada perna · Primeiro amigo ativado · 5 amigos ativados · Primeira subida de divisão · Nivelamento refeito com melhora

## 10. Retenção: ofensiva e sistema de avisos

A retenção se apoia em três peças que trabalham juntas: a ofensiva (dias seguidos com pelo menos 1 desafio), as proteções que evitam que um deslize mate o hábito e uma régua de avisos por push, e-mail e dentro do app. O alvo principal é a primeira semana, que é quando mais gente desiste.

### 10.1 O que aprendemos com o Duolingo

- **A métrica que mais move crescimento é a retenção de quem já usa.** O Duolingo simulou o efeito de cada taxa de retenção no número de usuários diários e descobriu que a retenção dos usuários atuais (CURR) era a de maior impacto. Criou um time só para ela. Em 2026 essa taxa chegou a 84% de retorno no dia seguinte. ([Duolingo Blog](https://blog.duolingo.com/growth-model-duolingo/), [Subscription Insider](https://www.subscriptioninsider.com/blog/duolingo-s-q2-paid-subscriber-growth-outpaces-subscription-bookings-news))
- **A ofensiva é a principal alavanca de retenção**, mas não salva um produto fraco: ela amplifica o valor que o usuário já encontra. ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks))
- **A primeira semana é a mais frágil.** Quem passa dos 7 dias tem chance muito maior de ficar. ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks))
- **Compromisso explícito funciona.** Trocar o texto do botão de "continuar" para "assumir meu compromisso" e deixar o usuário escolher a meta de ofensiva aumentaram a retenção. ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/behind-the-product-duolingo-streaks))
- **Protetor de ofensiva perdoa um dia perdido e reduz abandono.** No Duolingo, usuários gratuitos guardam até 2 protetores, e o uso é automático e silencioso. ([Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks))
- **Marcos de 7, 30, 100 e 365 dias interrompem o fluxo para celebrar** e dão recompensas. Os cartões compartilháveis desses marcos multiplicaram o compartilhamento orgânico. ([Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks))
- **Ofensiva com amigo:** quem tem pelo menos uma é 22% mais provável de fazer a lição do dia. ([Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks))
- **O último aviso do dia é a última linha de defesa:** um push à noite avisa que a ofensiva vai acabar. ([Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks))
- **Texto rotativo vence texto fixo.** O Duolingo escolhe o lembrete de cada usuário por algoritmo, mede sucesso como lição feita em até 2 horas e penaliza mensagens vistas recentemente, porque a novidade perde efeito. Isso trouxe +2% de retenção de novos usuários. ([Duolingo Research](https://research.duolingo.com/papers/yancey.kdd20.pdf), [Papers with Code](https://paperswithcode.com/paper/a-sleeping-recovering-bandit-algorithm-for))
- **Reativar rápido, depois parar.** A melhor janela para trazer alguém de volta são os primeiros 3 a 4 dias ([Sub Club](https://podcastaddict.com/sub-club-by-revenuecat/episode/193646765)). Depois de cerca de 1 semana, o Duolingo manda "parece que os lembretes não estão funcionando, vamos parar por enquanto", uma das mensagens mais eficazes deles. ([Gigazine](https://gigazine.net/gsc_news/en/20240618-duolingo-app-streaks))
- **Amigos reativam melhor que o app.** Pedir que usuários ativos chamem amigos de volta funciona melhor que campanhas comuns de reativação. ([Sub Club](https://podcastaddict.com/sub-club-by-revenuecat/episode/193646765))

**O que adaptamos para exercício:** o tom é bem-humorado e encorajador, nunca de culpa nem sobre corpo ou peso. Quem relatou dor recebe sugestão de mobilidade ou respiração, nunca de treino intenso.

### 10.2 Regras da ofensiva

- **Conta o dia:** pelo menos 1 desafio concluído (qualquer modalidade, inclusive respiração), no fuso do usuário, até 23h59.
- **Compromisso inicial:** no onboarding, o usuário escolhe uma meta de ofensiva de 7, 14 ou 30 dias, com o botão "Assumir meu compromisso". A trilha mostra o progresso até a meta.
- **Marcos:** 3, 7, 14, 30, 50, 100 e 365 dias. Cada marco tem tela de celebração, uma recompensa (protetor, XP extra ou selo no perfil) e um cartão compartilhável para stories e WhatsApp.
- **Protetor de ofensiva:**
  - Guarda até 2 (até 4 para quem tem ofensiva de 100 dias ou mais).
  - Ganha 1 a cada 7 dias seguidos, em marcos, ao subir de divisão na liga e quando um convidado ativa.
  - É usado automaticamente num dia sem desafio. No dia seguinte, o app mostra o dia protegido no calendário e avisa quantos restam.
- **Recuperar ofensiva:** se a ofensiva quebrar sem protetor, o usuário tem 48 h para fazer 3 desafios e recuperá-la. Vale 1 vez por mês.
- **Semana perfeita:** 7 dias seguidos sem usar protetor rendem um selo e uma chama de cor diferente.
- **Ofensiva com amigo:**
  - Até 5 por usuário, cada uma independente.
  - Só avança se os dois fizerem pelo menos 1 desafio no mesmo dia.
  - Níveis aos 7, 14, 30 e 50 dias.
  - Botão "cutucar" manda um push ao amigo em nome do usuário.
- **Calendário da ofensiva:** tela com os dias feitos, os protegidos e o recorde.

### 10.3 Canais

| Canal | Uso | Observação técnica |
| --- | --- | --- |
| Push (Web Push) | Lembretes do dia, salva-ofensiva, amigos, liga | Android: funciona no navegador. iPhone: só com o app instalado na tela inicial (iOS 16.4 ou mais), por isso a instalação é incentivada logo no primeiro dia |
| E-mail | Boas-vindas, ofensiva quebrada, reativação, resumo semanal | Envio por serviço transacional (ex.: Resend), com link de descadastro por tipo |
| Dentro do app | Banner de risco, calendário, celebrações, cartões de convite | Sempre ativo, sem permissão |
| Número no ícone | Mostra a ofensiva no ícone do app instalado | Badging API, onde houver suporte |

Widget na tela inicial, como o do Duolingo, não existe para PWA. Fica para o app nativo.

### 10.4 Régua de avisos

Os horários usam o fuso do usuário. "HL" é o horário de lembrete que ele escolheu.

| Momento | Condição | Canal | Exemplo de texto |
| --- | --- | --- | --- |
| D0, após cadastro | Conta criada | E-mail | "Bem-vindo! Seu primeiro desafio leva 5 minutos. Bora?" |
| D0, 2 h após cadastro | Não fez o 1º desafio | Push | "Seu treinador de bolso está pronto. 5 minutos e você começa sua ofensiva." |
| Todo dia, no HL | Ainda não fez desafio hoje | Push | "Dia 6 da sua ofensiva. Um desafio de 5 min mantém a chama acesa." |
| Todo dia, 20h | Ofensiva de 3 dias ou mais e nada feito hoje | Push | "Sua ofensiva de 12 dias está em risco. Que tal 3 minutos de mobilidade?" |
| Todo dia, 22h | Ofensiva de 3 dias ou mais, nada feito e sem protetor | Push | "Última chamada: sua ofensiva de 12 dias acaba à meia-noite." |
| Manhã seguinte | Protetor foi usado | Push + app | "Seu protetor salvou a ofensiva ontem. Resta 1. Vamos manter hoje?" |
| D+1 após quebra | Ofensiva quebrou | Push + e-mail | "Sua ofensiva de 15 dias acabou, mas dá para recuperar: 3 desafios em 48 h." |
| D+2 e D+3 inativo | Sem desafio | Push | "Só 3 minutos hoje? A gente começa leve." |
| D+3 inativo | Tem amigo ativo | Push ao amigo | "Ana sumiu há 3 dias. Que tal cutucar?" |
| D+5 inativo | Sem desafio | E-mail | Resumo do que a pessoa já conquistou e convite para um desafio curto |
| D+7 inativo | Sem desafio | Push + e-mail | "Parece que os lembretes não estão funcionando. Vamos parar por enquanto. Quando quiser voltar, estamos aqui." |
| D+30 inativo | Avisos pausados | E-mail | Uma única mensagem de volta, sugerindo refazer o nivelamento |
| Marco de ofensiva | Atingiu 7, 14, 30... | App + push | "30 dias seguidos! Você ganhou um protetor." + cartão compartilhável |
| Amigo cutucou | Cutucada recebida | Push | "Bruno te cutucou: bora treinar hoje?" |
| Ofensiva com amigo em risco | Amigo já fez, usuário não | Push, 19h | "Bruno já fez o dele. Falta só você para a ofensiva de vocês chegar a 14 dias." |
| Domingo, 18h | Na zona de rebaixamento ou perto de subir | Push | "Faltam 6 horas e você está a 40 pontos de subir para o Ouro." |
| Segunda, 9h | Usuário ativo na semana | E-mail | Resumo semanal: minutos, repetições, melhores KPIs, ofensiva, posição na liga |

### 10.5 Regras de frequência e tom

- **Limites:** no máximo 2 push por dia sobre treino (amigos e liga contam à parte, até 4 no total) e 1 e-mail por dia.
- **Horário silencioso:** nada entre 22h30 e 8h.
- **Pausa:** depois de 7 dias sem desafio, os pushes de lembrete param. Só voltam quando o usuário volta ou na mensagem única do D+30.
- **Controle do usuário:** liga e desliga cada tipo (lembrete, ofensiva, amigos, liga, resumo semanal) e escolhe o horário. Descadastro de e-mail por tipo, com um clique.
- **Textos rotativos:** cada gatilho tem pelo menos 5 variações. O sistema não repete a mesma variação para o mesmo usuário em 7 dias.
- **Medição:** cada aviso registra se o usuário fez um desafio em até 2 h. Com volume suficiente, as variações que convertem mais passam a ser enviadas com mais frequência (versão simples do algoritmo do Duolingo).
- **Tom:** bem-humorado e acolhedor. Nunca culpa, nunca vergonha do corpo, nunca "você está engordando". Para quem relatou dor nos últimos 3 dias, só sugestões de baixa intensidade.

### 10.6 Métricas de retenção

| Métrica | Definição |
| --- | --- |
| Retenção de atuais (CURR) | % de quem fez desafio ontem e nos dias anteriores e voltou hoje |
| Retenção de novos (NURR) | % de novos usuários que voltam no dia 1, no dia 7 e no dia 28 |
| Taxa de reativação | % de inativos (2 a 30 dias) que voltam na semana |
| Ativos com ofensiva de 7 dias ou mais | % dos ativos do dia |
| Conversão de aviso | % de avisos seguidos de desafio em até 2 h, por gatilho e por variação |
| Descadastro | % de usuários que desligam push ou e-mail, por tipo |
| Uso de protetor e recuperação | Protetores usados e ofensivas recuperadas por semana |

## 11. Modelo de dados

O banco tem 30 tabelas no Postgres do Supabase, em três grupos: usuário, conteúdo e jogo. O conteúdo (exercícios, níveis, desafios, músicas, textos de aviso) é lido por todos; os dados do usuário só pelo dono, via RLS, com exceções explícitas para amigos e liga.

### 11.1 Usuário

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| profiles | id (= auth.users.id), apelido, data\_nascimento, sexo, altura\_cm, peso\_kg, objetivo, nivel\_atividade, dias\_semana, meta\_desafios\_dia, equipamentos (array), musica\_estilo, volume\_musica, volume\_voz, horario\_lembrete, fuso\_horario, limitacoes (array), dificuldade\_atual, liberado\_alta\_intensidade, divisao\_atual, codigo\_convite, convidado\_por, criado\_em | Apelido, foto, divisão e nível atual são visíveis para outros (via view pública) |
| consents | user\_id, tipo (termos, privacidade, dados\_saude), versao, aceito\_em | Histórico; nunca sobrescrever |
| health\_screenings | user\_id, respostas (jsonb), algum\_sim, realizado\_em | Dado de saúde |
| baselines | user\_id, realizado\_em, agachamentos\_40s, polichinelos\_30s, apoio\_unipodal\_e\_s, apoio\_unipodal\_d\_s, amplitude\_ombro\_graus, dificuldade\_resultante | Um registro por nivelamento |
| pain\_reports | user\_id, attempt\_id, exercise\_id, regiao, acao\_tomada, criado\_em | Usado para trocar exercícios e filtrar avisos |
| notification\_preferences | user\_id, lembrete, ofensiva, amigos, liga, resumo\_semanal (booleanos), email\_ativo, push\_ativo, pausado\_ate | Controle do usuário sobre os avisos |
| push\_subscriptions | id, user\_id, endpoint, chaves, aparelho, criado\_em, ativo | Uma por aparelho |

### 11.2 Conteúdo

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| exercises | id (slug), nome, modalidade, camera (frontal, lateral), definicao (jsonb, ver seção 8.2), equipamento, demo\_url, variacao\_facil\_id, ativo | A definição alimenta o motor de detecção |
| levels | id, ordem, tema, equipamentos\_necessarios (array), avisar\_no\_nivel | 8 no MVP |
| challenges | id, level\_id, ordem, titulo, modalidade, duracao\_s, intensidade, equipamento, opcional\_em\_8 (bool), extra\_em\_12 (bool) | 8 a 12 por nível |
| challenge\_blocks | id, challenge\_id, ordem, exercise\_id, formato, series, parametros\_por\_dificuldade (jsonb), descanso\_s | Parâmetros escalados pela dificuldade pessoal |
| music\_tracks | id, estilo, titulo, url, bpm, duracao\_s, licenca, fonte | Só faixas com licença comprovada |
| notification\_templates | id, gatilho, canal (push, email, app), variacao, titulo, texto, ativo | Pelo menos 5 variações por gatilho |

### 11.3 Jogo

| Tabela | Campos principais | Observações |
| --- | --- | --- |
| challenge\_attempts | id, user\_id, challenge\_id, level\_session\_id (opcional), dificuldade, modo (camera, manual), status (em\_andamento, concluido, abandonado, encerrado\_dor), aquecimento\_auto, iniciado\_em, concluido\_em, score, estrelas, xp, esforco\_percebido, valido\_para\_liga | Uma por tentativa de desafio |
| attempt\_blocks | attempt\_id, challenge\_block\_id, exercise\_id, serie, reps\_validas, reps\_parciais, tempo\_valido\_s, kpis (jsonb), score\_bloco, fora\_quadro\_pct | Somente números; nenhum vídeo ou imagem |
| level\_sessions | id, user\_id, level\_id, iniciada\_em, encerrada\_em, desafios\_concluidos, completa | Registra o modo "nível completo" |
| user\_challenge\_progress | user\_id, challenge\_id, liberado, melhor\_score, melhores\_estrelas, tentativas | Estado dos desafios |
| user\_level\_progress | user\_id, level\_id, liberado, concluido\_em, estrelas | Estado da trilha |
| xp\_events | id, user\_id, tipo, valor, attempt\_id, criado\_em | Fonte da verdade do XP |
| streaks | user\_id, atual, recorde, ultimo\_dia\_ativo, protetores, meta\_compromisso, recuperar\_ate, recuperacoes\_no\_mes, inicio\_semana\_perfeita | Atualizada só por função no servidor |
| streak\_days | user\_id, dia, tipo (feito, protegido, recuperado) | Alimenta o calendário da ofensiva |
| friendships | user\_a, user\_b, origem (convite, codigo), criado\_em | Par único, sem direção |
| friend\_streaks | user\_a, user\_b, atual, recorde, ultimo\_dia | Até 5 por usuário |
| nudges | id, de\_user, para\_user, criado\_em | Cutucadas; limite de 1 por amigo por dia |
| invites | id, inviter\_id, invitee\_id, canal, cadastrado\_em, ativado\_em, recompensado | Base da métrica viral |
| leagues | id, divisao, semana\_inicio, semana\_fim, status | Criadas toda segunda |
| league\_members | league\_id, user\_id, pontos, posicao\_final, resultado (subiu, manteve, desceu) | Visível para membros do mesmo grupo |
| achievements e user\_achievements | id, nome, descricao, criterio / user\_id, achievement\_id, conquistada\_em | 12 conquistas no MVP |
| notification\_log | id, user\_id, gatilho, template\_id, canal, enviado\_em, aberto\_em, desafio\_em\_2h | Limites de frequência, rotação de textos e medição |

### 11.4 Lógica no servidor (Edge Functions, funções SQL e cron)

- `finalizar_desafio`: recebe os KPIs, recalcula score e estrelas, grava XP, atualiza ofensiva, ofensivas com amigos, progresso do desafio e do nível, pontos de liga, conquistas e ativação de convite, numa única transação.
- `ativar_convite`: chamada por `finalizar_desafio` no 1º desafio do convidado; cria a amizade, dá protetores e XP e avisa quem convidou.
- `processar_ofensivas` (a cada hora): para cada fuso que acabou de virar o dia, aplica protetor, abre janela de recuperação ou zera a ofensiva.
- `agendar_avisos` (a cada 15 min): avalia os gatilhos da seção 10.4 por fuso, aplica limites e horário silencioso, escolhe a variação de texto não usada nos últimos 7 dias e envia push ou e-mail.
- `medir_avisos` (a cada hora): marca `desafio_em_2h` no registro de avisos.
- `fechar_semana_liga` (domingo 23h59 BRT): calcula posições, sobe e desce divisões.
- `montar_ligas` (segunda 00h05 BRT): agrupa usuários ativos em grupos de 30.
- `resumo_semanal` (segunda 9h, por fuso): e-mail com os números da semana.
- `exportar_dados` e `excluir_conta`: LGPD.

## 12. Requisitos técnicos, privacidade e segurança

A regra central é que nenhuma imagem do usuário sai do aparelho: o servidor recebe só números. Isso simplifica a LGPD e é o principal argumento de confiança do produto.

### 12.1 Stack

| Camada | Escolha |
| --- | --- |
| Front-end | Next.js (App Router) + TypeScript + Tailwind CSS |
| PWA | Manifesto, service worker, instalação na tela inicial, cache do modelo de pose |
| Detecção de pose | @mediapipe/tasks-vision (Pose Landmarker), execução em GPU (WebGL) com fallback para CPU |
| Voz e som | Web Speech API para frases, Web Audio para sons curtos |
| Backend | Supabase: Auth (Google), Postgres com RLS, Edge Functions, cron |
| Notificações | Web Push (no iPhone, só com o app instalado na tela inicial, iOS 16.4 ou mais) |
| Hospedagem | Vercel |
| Código | Repositório no GitHub, deploy automático a partir da branch principal |
| Analítica | PostHog ou Plausible, sem dados de saúde nos eventos |
| E-mail | Resend + React Email, com descadastro por tipo de aviso |
| Música | Faixas em MP3/AAC no Supabase Storage, carregadas sob demanda e guardadas em cache; tocadas por Web Audio com redução automática de volume quando a voz fala |

### 12.2 Compatibilidade

- Chrome Android 110 ou mais e Safari iOS 16.4 ou mais.
- Layout pensado para 360 a 430 px de largura; no desktop, o app aparece centralizado em coluna de celular.
- Orientação retrato na trilha; durante o desafio, retrato ou paisagem conforme o exercício pede.
- Tela não apaga durante o desafio (Wake Lock API).

### 12.3 Privacidade (LGPD)

- Consentimento específico e destacado para dados de saúde (peso, altura, triagem, relatos de dor).
- Política de privacidade em linguagem simples, com versão registrada no aceite.
- Exportar dados (JSON) e excluir conta pelo app, sem precisar pedir por e-mail.
- Nenhum vídeo, foto ou ponto do corpo frame a frame é salvo ou enviado; só KPIs agregados.
- Ranking mostra apenas apelido, avatar e divisão.

### 12.4 Segurança do usuário

- Triagem PAR-Q+ obrigatória, refeita a cada 12 meses.
- Aviso antes do primeiro desafio: espaço livre de 2 x 2 m, piso sem escorregar, água por perto.
- Botão "senti dor" em todo desafio; dor no mesmo local em 2 desafios seguidos troca automaticamente os exercícios que envolvem aquela região e recomenda procurar um profissional.
- Texto padrão: o app não substitui avaliação médica nem acompanhamento profissional.

### 12.5 Acessibilidade

- Contraste mínimo AA, botões com pelo menos 48 px de altura, textos com tamanho ajustável.
- Feedback de repetição em três canais: número na tela, som e vibração.
- Respeitar a preferência de movimento reduzido nas animações de celebração.

### 12.6 Música e direitos autorais

- Só entram faixas com licença que permite uso comercial em app sem atribuição obrigatória na tela, ou com a atribuição feita na tela de créditos.
- A licença de cada faixa fica registrada (fonte, tipo, data, comprovante).
- MVP: 3 estilos com 4 faixas cada, de 3 a 5 minutos, entre 100 e 140 BPM.
- Nenhuma integração com Spotify ou outro streaming no MVP. Quem quiser ouvir a própria música escolhe "sem música" e usa outro app em paralelo.

## 13. Critérios de aceite e métricas de sucesso

O MVP está pronto para o grupo de teste quando todos os critérios abaixo passam. Ele é considerado validado se bater as metas de hábito e de convite depois de 4 semanas.

### 13.1 Critérios de aceite

- [ ] Usuário novo entra com Google, completa perfil e triagem e chega à trilha em até 3 minutos (sem contar o nivelamento).
- [ ] Os 19 exercícios são validados pela câmera frontal com erro máximo de 1 repetição a cada 10 (ou 2 s em 60 s nas isometrias), testados em 5 pessoas, 2 ambientes de luz e 2 celulares.
- [ ] A tela de execução mostra série, repetições feitas/total e KPIs ao vivo, legíveis a 3 m.
- [ ] "Só um desafio" e "Nível completo" funcionam; um nível interrompido guarda os desafios feitos.
- [ ] Aquecimento automático aparece antes de desafios intensos sem aquecimento recente.
- [ ] Avisos de equipamento aparecem nos níveis certos, e quem não tem o item recebe alternativas.
- [ ] Música toca, abaixa quando a voz fala e pode ser desligada.
- [ ] Perder o corpo do quadro pausa o desafio em até 1 s e retoma sozinho.
- [ ] Score, estrelas e XP calculados no servidor batem com os da tela.
- [ ] Ofensiva, protetor, recuperação, semana perfeita e ofensiva com amigo funcionam na virada do dia de cada fuso.
- [ ] A régua de avisos dispara os gatilhos da seção 10.4, respeita limites, horário silencioso e pausa de 7 dias, e não repete texto em 7 dias.
- [ ] Link de convite leva à landing personalizada, registra quem convidou e recompensa os dois na ativação.
- [ ] Liga forma grupos na segunda, mostra ranking ao vivo e sobe e desce divisões no domingo.
- [ ] Nenhuma requisição de rede leva imagem ou vídeo (conferido no inspetor de rede).
- [ ] Usuário consegue exportar e excluir os próprios dados e desligar cada tipo de aviso.
- [ ] Um usuário não consegue ler dados de saúde de outro, nem de amigos (teste de RLS).
- [ ] App instalável na tela inicial em Android e iPhone, com push funcionando nos dois.

### 13.2 Métricas de sucesso (grupo de teste, 4 semanas)

| Área | Métrica | Meta |
| --- | --- | --- |
| Ativação | Onboarding concluído (login até 1º desafio) | 70% ou mais |
| Ativação | Tempo até começar o 1º desafio depois de abrir a câmera | até 90 s |
| Ativação | App instalado na tela inicial | 40% ou mais |
| Hábito | Ativos em 3 dias ou mais na semana 1 | 25% ou mais |
| Hábito | Retenção no dia 1 / dia 7 / dia 28 | 50% / 30% / 15% ou mais |
| Hábito | Retenção de atuais (CURR) | 70% ou mais |
| Hábito | Ativos com ofensiva de 7 dias ou mais | 30% ou mais |
| Hábito | Desafios por usuário ativo por semana | 5 ou mais |
| Hábito | Usuários que fizeram pelo menos 1 nível completo numa sessão | acompanhar |
| Avisos | Conversão de aviso em desafio em até 2 h | 10% ou mais |
| Avisos | Descadastro de push ou e-mail | 10% ou menos |
| Convites | Ativos que enviam 1 convite ou mais | 30% ou mais |
| Convites | Convites enviados que viram cadastro | 25% ou mais |
| Convites | Cadastros por convite que ativam (1º desafio) | 60% ou mais |
| Convites | Coeficiente viral K (convites por usuário × taxa de ativação) | 0,3 ou mais |
| Qualidade | Desafios abandonados no meio | 15% ou menos |
| Qualidade | Usuários que discordam da contagem (pergunta no fim do desafio) | 10% ou menos |
| Segurança | Relatos de dor por 100 desafios | acompanhar; investigar exercício com mais de 3 |

## 14. Plano de construção e prompt para o Fable

A construção vai em 7 fases e começa pelo motor de detecção, porque ele é o maior risco: se a contagem não for confiável, o resto não importa. Cada fase termina com algo testável no celular.

| Fase | Entrega | Pronto quando |
| --- | --- | --- |
| 0. Teste técnico | Página com câmera frontal, esqueleto e contagem de agachamento, polichinelo e apoio em uma perna, com o contador "8/12" | Erro de até 1 em 10 em 3 pessoas |
| 1. Fundação | Next.js, Supabase, login Google, banco com RLS, onboarding completo, perfil, landing de convite que registra quem convidou | Usuário novo, convidado ou não, chega à trilha vazia |
| 2. Motor completo | Motor genérico lendo definições JSON, 19 exercícios, KPIs, tela de execução (seção 8.5), voz, música, pausa por perda de detecção | Critérios de aceite de detecção passam |
| 3. Campanha | Trilha, 8 níveis, desafios, "só um desafio" e "nível completo", aquecimento automático, nivelamento, avisos de equipamento, seed de conteúdo | Usuário conclui o Nível 1 dos dois jeitos |
| 4. Jogo e social | Score no servidor, XP, ofensiva completa (protetor, recuperação, semana perfeita, ofensiva com amigo), liga, amigos, convites com recompensa, cutucada, conquistas | Simulação de 2 semanas com 30 contas de teste fecha ligas, ofensivas e convites certo |
| 5. Retenção | Web Push, e-mail, régua de avisos da seção 10.4, textos rotativos, limites, pausa de 7 dias, preferências, medição em 2 h, resumo semanal | Cada gatilho dispara corretamente em conta de teste com relógio simulado |
| 6. Lançamento fechado | PWA instalável, exportar e excluir dados, analítica com as métricas da seção 13.2, termos, créditos de música | Todos os critérios de aceite passam |

### Como usar com o Fable

1. Crie um repositório vazio no GitHub e um projeto no Supabase.
2. Exporte este documento em Markdown e salve na raiz do repositório como `docs/ESPECIFICACAO.md`.
3. Abra uma sessão de código com o Fable apontando para o repositório e cole o prompt abaixo.
4. Peça uma fase por vez e teste no celular antes de seguir.

```markdown
Você vai construir o MVP do Hive Break, um jogo de atividade física no navegador, mobile first, descrito em docs/ESPECIFICACAO.md. Leia o documento inteiro antes de começar.

Contexto: sou Diretor Técnico de um centro de performance esportiva. O produto é um "Duolingo do exercício": desafios de até 5 minutos, agrupados em níveis de 8 a 12 desafios (sessão completa de 40 a 60 min, do aquecimento à respiração). O usuário faz só um desafio ou o nível inteiro. A câmera frontal do celular valida os movimentos com detecção de pose (MediaPipe Pose Landmarker), conta repetições, mede KPIs e gera score, XP, ofensiva, liga semanal e ranking entre amigos. Convites e retenção (ofensiva + régua de avisos por push e e-mail) fazem parte do MVP porque queremos validar hábito e crescimento por indicação.

Regras inegociáveis:
- Nenhuma imagem ou vídeo sai do aparelho. O servidor recebe só KPIs numéricos.
- Só câmera frontal.
- Exercícios são definidos como dados (JSON) e interpretados por um motor genérico de máquina de estados (seção 8).
- Score, XP, ofensiva, liga e convites são calculados e validados no servidor (seções 9, 10 e 11.4).
- Dados de saúde protegidos por RLS no Supabase; teste isso.
- Avisos seguem limites, horário silencioso, pausa de 7 dias e tom da seção 10.5.
- Só música com licença registrada (seção 12.6).
- Interface em português do Brasil, mobile first (360 a 430 px).

Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Auth Google, Postgres, RLS, Edge Functions, cron, Storage), @mediapipe/tasks-vision, Web Push, Resend para e-mail, deploy na Vercel.

Como trabalhar:
- Siga as fases da seção 14, uma por vez. Comece pela Fase 0 (teste técnico) e pare ao final dela para eu testar no celular.
- Antes de cada fase, escreva um plano curto com arquivos e decisões; depois implemente.
- Escreva testes unitários para o motor de detecção usando sequências de landmarks gravadas (fixtures em JSON), para o cálculo de score, para as regras de ofensiva e para a régua de avisos (com relógio simulado).
- Crie as migrações SQL do modelo de dados da seção 11 e um seed com os 19 exercícios, 8 níveis, os desafios de cada nível e pelo menos 5 variações de texto por gatilho de aviso.
- Se algo no documento estiver ambíguo ou conflitante, pergunte antes de decidir. Registre decisões em docs/DECISOES.md.
- Ao final de cada fase, liste o que testar no celular e o que ficou pendente.

Comece agora pela Fase 0.
```

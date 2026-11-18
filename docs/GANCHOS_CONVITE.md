# Hive Break — Ganchos de convite (versão 1, 18/11/2026)

> Item #2 da ordem de execução (`SOCIAL_CRUZAMENTO_16.md`, seção 5).
> Versão 1 escrita antes do mapa do público; será revisada quando a pesquisa (`BRIEFING_PESQUISA_MAPA_PUBLICO.md`) voltar.
> Ganchos de benefício só usam o que a ciência sustenta (`CIENCIA_BREAKS.md`).

## 1. Regras
- Gancho com até ~12 palavras. Depois do gancho vem só o link.
- Voz da marca (`BRAND.md`): leve, direto, acolhedor. Sem culpa, sem ameaça.
- **Nunca:** emagrecimento, estética, corpo; "aumenta a produtividade em X%"; "trata ansiedade/depressão"; "previne hérnia"; zoar quem não aguenta.
- Variáveis: `{nome}` (quem convida), `{exercicio}`, `{reps}`, `{tempo}`, `{dias}` (ofensiva), `{duracao}` (min), `{n}` (pessoas), `{seg}`, `{amigo}`, `{link}`.
- Termo do grupo: **hive** (feminino, minúsculo), também na interface em português. Não usar "colmeia" na interface (BRAND.md atualizado em 18/11/2026). O produto é sempre "Hive Break".

## 2. As três famílias (para o teste A/B do piloto)

### 2.1 Desafio (`D`)
| id | Texto |
|---|---|
| D01 | {nome} fez {reps} {exercicio} em {tempo}. Você bate? |
| D02 | Aguenta 30 segundos de prancha? Prova aí. |
| D03 | Fiz {reps} agachamentos em 1 minuto. Sua vez. |
| D04 | Meu recorde: {reps}. Vem tentar tirar ele de mim. |
| D05 | Te desafiei num break de 3 min. Aceita? |
| D06 | {dias} dias seguidos. Quantos você aguenta? |
| D07 | Quem faz mais polichinelos em 1 minuto: eu ou você? |
| D08 | Revanche aberta: {reps} reps. Topa? |
| D09 | Prancha de 45 s. Fiz. E você? |
| D10 | Quanto agachamento você faz em 40 segundos? |
| D11 | Desafio rápido: cabe entre uma reunião e outra. |
| D12 | 1 minuto. Máximo de repetições. Valendo. |
| D13 | Meu placar tá sozinho no topo. Vem. |
| D14 | 3 minutos. A câmera conta, você só mexe. |
| D15 | Duvido você fechar 3 minutos sem parar. |

### 2.2 Benefício (`B`)
| id | Texto | Base |
|---|---|---|
| B01 | Isso tá me ajudando com a lombar. Faz comigo? | Shiri 2018; Thorp 2014 |
| B02 | 3 minutos e a tarde ficou bem menos pesada. | Albulescu 2022 (fadiga) |
| B03 | Levantar a cada 30 min alivia a lombar. Bora? | Thorp 2014 |
| B04 | 2 minutos por dia pro pescoço parar de reclamar. | Andersen 2011 |
| B05 | Sentado o dia todo? 3 minutos já mudam a tarde. | Diaz 2023 |
| B06 | Meu pescoço agradece. O seu também vai. | Andersen 2011 |
| B07 | Uma pausa de 3 min pra recuperar a energia das 15h. | Albulescu 2022 |
| B08 | Lombar travada de tanto sentar? Achei um jeito de mexer. | Thorp 2014 |
| B09 | Não é academia: 3 minutos no meio do expediente. | — |
| B10 | Volto pra mesa mais leve. Testa uma vez. | Albulescu 2022 |
| B11 | Fortalecer lombar e abdômen reduz o risco de dor nas costas. Bora? | Shiri 2018 |
| B12 | Menos cansaço e mais humor em 5 minutos de break. | Diaz 2023 |
| B13 | Cuidar da coluna sem sair da sala. 3 minutos. | Shiri 2018 |
| B14 | Ombro duro de tanta call? Esse break ajudou meu dia. | Andersen 2011 |
| B15 | Saúde que cabe entre duas reuniões. | — |

### 2.3 Companhia (`C`)
| id | Texto |
|---|---|
| C01 | Bora um break de 3 minutos comigo? |
| C02 | Sozinho eu esqueço. Faz comigo? |
| C03 | Montei uma hive. Falta você. |
| C04 | Tô fazendo uns breaks de 3 min. Vem junto? |
| C05 | A hive tá esperando. Entra aí. |
| C06 | Me ajuda a não quebrar a sequência? Faz comigo. |
| C07 | Break das 15h. Cola com a gente? |
| C08 | Mais fácil em dupla. Topa ser minha dupla? |
| C09 | Ninguém vê sua câmera, só os números. Vem. |
| C10 | 3 minutinhos juntos e cada um volta pro trabalho. |

## 3. Onde cada gancho entra

### 3.1 Texto que acompanha o card pós-treino (campo `text` do Web Share)
Formato: `{gancho}\n{link}`. Escolha automática pelo estado do treino (na ordem de prioridade abaixo):

| Estado | Família / ids |
|---|---|
| Bateu recorde | D04, D08, D13 |
| Ofensiva ≥ 7 dias | D06, C06 |
| 1º dia (ou sequência reiniciada) | C04 ou "O 1º de muitos. Vem comigo?" |
| Treino do Modo Escritório (lombar, pescoço, ombro) | B01, B04, B06, B13, B14 |
| Treinou em hive | C03, C05, C07 |
| Demais casos | rotação igual entre D, B e C (teste A/B) |

A pessoa sempre pode trocar o texto antes de enviar (botão "Trocar frase" mostra outro gancho da mesma família).
Ganchos com variável que não existe naquele treino (ex.: {reps} num desafio de isometria) devem ser pulados.

### 3.2 Prévia do link no WhatsApp (Open Graph)
| Família | Título | Descrição |
|---|---|---|
| Desafio | {nome} te desafiou no Hive Break | {exercicio}: {reps}. Leva 3 minutos, direto no navegador. |
| Benefício | {nome} te chamou para um break de 3 min | Mexa o corpo sem sair da sala. Direto no navegador. |
| Companhia | {nome} quer fazer um break com você | 3 minutos juntos. Direto no navegador. |

Imagem da prévia: o próprio card (ou versão sem foto), nunca o logo genérico. Quando o fluxo de visitante (#5) estiver pronto, acrescentar "Sem cadastro para começar."

### 3.3 Hive ao vivo
- Notificação/WhatsApp: "{nome} começou uma hive de {duracao} min. Entra?"
- Sala aberta: "Hive aberta com {n} pessoas. Começa em {seg} s."
- Botão: "Chamar no WhatsApp" → "Bora um break? Hive aberta agora: {link}"

### 3.4 Resgate (3 dias sem break)
- Para quem resgata: "{amigo} tá há 3 dias sem break. Chamar?"
- Mensagem enviada (escolher uma): "Sentimos sua falta na hive. 3 minutinhos hoje?" · "Bora voltar? Eu faço com você." · "Sua sequência pode recomeçar hoje. Vem comigo."
- Nunca mostrar no feed nem para o gestor.

### 3.5 Bônus de hive completa
- Para quem está na hive: "Falta {nome} para o bônus de hive completa. Chamar para fazer agora?"
- Mensagem enviada: "Só falta você pra fechar o bônus da hive. Bora?"
- Se a pessoa marcou "parei por dor ou compromisso": não mostrar o aviso.

## 4. Como medir (teste A/B)
- Link com parâmetros: `?g=D|B|C&h=<id>&ref=<usuario>`.
- Funil por família e por id: **convite enviado → link aberto → desafio iniciado → desafio concluído → cadastro**.
- Rotação igual entre as famílias nos "demais casos". Esperar pelo menos ~100 aberturas por família antes de concluir.
- Hipóteses: (1) desafio converte mais entre amigos; (2) benefício converte mais entre colegas de trabalho e 35+; (3) companhia tem mais envios, mas menor taxa de abertura.
- Depois do mapa do público: cortar os 5 piores de cada família e escrever novos com a linguagem real do público.

## 5. Para o Claude Code
- Guardar os ganchos num arquivo de dados (ex.: `src/conteudo/ganchos.ts`) com `{ id, familia, texto, contextos[] }`, não espalhados nas telas.
- Função `escolherGancho(contexto, estadoDoTreino)` aplicando a tabela 3.1.
- Registrar `familia` e `id` no evento de compartilhamento e no clique do link (tabela `convite_eventos`).

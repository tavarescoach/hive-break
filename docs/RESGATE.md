# Hive Break — Resgate: "fulano está há 3 dias sem break" (18/11/2026)

> Item #4 da ordem de execução (`SOCIAL_CRUZAMENTO_16.md`, seção 5; pergunta 13).
> Referência: pop-up "Nudge" do Duolingo. Diferença do Hive Break: em vez de só "cutucar", quem resgata manda um **gancho** de desafio, benefício ou companhia (`GANCHOS_CONVITE.md`), escolhido por ele.
> Usa a infraestrutura de `FUNIL_LEMBRETES.md` (n8n, push, e-mail, preferências). Valores **[validar]** são padrão até decisão do Luan.

## 1. Princípio
"Quem cobra é o amigo, não a marca." Um convite de um amigo vale mais do que qualquer lembrete automático. Por isso, quando um amigo resgata, o lembrete automático W1 daquele dia é suprimido.

## 2. Quem pode ser resgatado
- Está há **3 dias ou mais** sem concluir um desafio.
- Já concluiu pelo menos 2 desafios na vida (não é recém-cadastrado; esse fica com a Ativação).
- É **amigo** de quem resgata (segue e é seguido) **ou** fez pelo menos 1 hive junto **ou** foi convidado por ele.
- Até **30 dias** sem atividade. Depois do 14º dia, no máximo 1 resgate por semana (respeita o silêncio do W3). **[validar]**
- Se a pessoa escondeu as estatísticas no perfil, o texto vira "faz alguns dias sem break" em vez do número.

## 3. Quando o pop-up aparece (para quem resgata)
- **Logo depois de concluir o próprio desafio** (a pessoa está animada e acabou de gerar um recorde para usar no gancho de desafio). Também ao abrir o app, se ainda não viu nenhum pop-up no dia.
- No máximo **1 pop-up por dia** por pessoa.
- Mostra **um amigo por vez**, na ordem: fez mais hives juntos → convidado por ele → amigo mais recente. Os outros ficam numa faixa na aba Amigos ("3 amigos sumidos. Chamar?").
- Se o amigo já foi resgatado hoje por outra pessoa, ele não aparece no pop-up de ninguém mais naquele dia.

### 3.1 Layout do pop-up
- Avatar hexagonal do amigo, em cinza, com a chama apagada.
- Título: **"{amigo} está há {dias} dias sem break"**.
- Linha de apoio: "Um convite seu vale mais que qualquer lembrete."
- Botão principal: **"Chamar {amigo}"**.
- Botão secundário: "Agora não".

## 4. Escolher a mensagem
Ao tocar em "Chamar {amigo}", abre uma folha com **3 mensagens sugeridas, uma de cada família**, já preenchidas com os dados reais de quem resgata. A pessoa toca na que quer, pode tocar em "Trocar frase" ou escrever a própria.

### 4.1 Ganchos de resgate (`R`)
| id | Família | Texto |
|---|---|---|
| RD1 | Desafio | Tenta bater meu recorde: {reps} {exercicio} em {tempo}. Bora? |
| RD2 | Desafio | Fiz {reps} {exercicio} hoje. Duvido você passar. |
| RD3 | Desafio | Revanche? Meu placar tá te esperando. |
| RB1 | Benefício | Me ajuda a cuidar da coluna? 3 minutos de exercício comigo. |
| RB2 | Benefício | 3 minutos pra tarde ficar mais leve. Faz comigo hoje? |
| RB3 | Benefício | Pescoço travado de call? Bora 3 minutos juntos. |
| RC1 | Companhia | Juntos rende mais: entra na minha hive e ganha até +60% de XP. |
| RC2 | Companhia | Sentimos sua falta na hive. 3 minutinhos hoje? |
| RC3 | Companhia | Bora voltar? Eu faço com você. |
| RC4 | Companhia | Sua sequência pode recomeçar hoje. Vem comigo. |

Regras de escolha:
- **Desafio:** usa o recorde ou o resultado de hoje de quem resgata (ex.: "Tenta bater meu recorde: 21 agachamentos em 1 minuto. Bora?"). Se ele não tem resultado com repetições, usa RD3.
- **Benefício:** prioriza RB1/RB3 se o amigo fazia treinos do Modo Escritório.
- **Companhia:** RC1 quando quem resgata vai abrir uma hive (ver 5.2); senão RC2–RC4.
- Nota: a frase "juntos somos mais produtivos" não foi usada porque a ciência não sustenta promessa de produtividade (`CIENCIA_BREAKS.md`, seção 3). O RC1 promete o que é verdade: XP a mais em hive (`BONUS_HIVE.md`).

## 5. Como a mensagem chega

### 5.1 Pelo app (principal)
- Push + e-mail imediatos para o amigo, via webhook do n8n (mesma via dos gatilhos imediatos do `FUNIL_LEMBRETES.md`).
- Push: título **"{nome} te chamou 🐝"**, texto = o gancho escolhido.
- E-mail: assunto **"{nome} te chamou para um break"**, corpo = gancho + avatar de quem chamou + 1 botão.
- Respeita as preferências do amigo: se ele desligou a categoria "Amigos/Hive" ou está com `pausado_ate`, o envio pelo app não aparece como opção.
- Conta no limite diário de push/e-mail do amigo, mas tem prioridade sobre o lembrete W1 (que é suprimido no dia).

### 5.2 Pelo WhatsApp (secundário)
- Botão "Mandar no WhatsApp": abre o compartilhamento com `{gancho}\n{link}`. O link leva `?g=R&h=<id>&ref=<quem resgata>&resgate=<id do resgate>`.
- Opção **"Abrir uma hive agora e chamar {amigo}"**: cria a hive e usa o RC1 com o link da hive.

### 5.3 O que o botão abre (para quem foi resgatado)
- Gancho de desafio → o mesmo desafio de quem resgatou (quando o desafio por link, item #6, estiver pronto, mostra o placar a bater).
- Gancho de benefício → um desafio curto do Modo Escritório (3 min).
- Gancho de companhia → a hive aberta, se houver; senão um desafio curto.

## 6. Recompensas
- **Para quem resgata:** se o amigo concluir um desafio em até **48 h** → **1 protetor de ofensiva** (máximo 2 por mês) **[validar]** + progresso na conquista **"Acolhida"** (resgatou X amigos).
- **Para quem voltou:** tela de boas-vindas ("{nome} te chamou e você voltou 🎉") + o evento de feed "voltou depois de {tempo}" (S5 do funil), em que os amigos podem mandar high five. Sem prêmio em XP, para não incentivar sumir e voltar.
- Quem resgatou recebe push: "{amigo} voltou! Seu convite funcionou 🙌".

## 7. Limites e privacidade
- Cada pessoa resgatada recebe no máximo **1 resgate por dia** e **3 por semana** (de todos os amigos somados).
- Quem resgata pode mandar no máximo **3 resgates por dia**.
- Nunca aparece no feed, nunca para gestor, nunca para quem não é amigo ou colega de hive.
- No modo empresa, o pop-up só mostra amigos e colegas de hive, nunca a lista da equipe inteira.
- O resgatado pode tocar em "Não quero esses convites" no e-mail/push → desliga a categoria "Amigos/Hive".

## 8. Dados
- Tabela `resgates`: `id`, `de_usuario_id`, `para_usuario_id`, `familia` (D | B | C), `gancho_id`, `texto_final`, `canal` (`app` | `whatsapp` | `hive`), `hive_id` (opcional), `enviado_em`, `voltou_em`, `recompensa_dada` (bool).
- Eventos: `rescue_prompt_shown`, `rescue_dismissed`, `rescue_sent`, `rescue_link_opened`, `rescue_returned`.
- Função no servidor `amigos_para_resgatar(usuario_id)`: aplica as regras das seções 2, 3 e 7 e devolve a lista ordenada.
- Ao concluir um desafio, verificar se existe resgate aberto há até 48 h para essa pessoa → marcar `voltou_em`, dar a recompensa, disparar os avisos da seção 6.
- No `lembretes_pendentes()` do funil: não enviar W1/W2 no dia em que a pessoa recebeu um resgate.

## 9. Métricas
- % de pop-ups que viram envio (por família).
- % de resgatados que voltam em 48 h: **resgate de amigo × lembrete automático W1** (a comparação mais importante).
- Família que mais traz de volta (D × B × C) e canal (app × WhatsApp × hive).
- % de "Não quero esses convites" (se passar de ~3%, revisar frequência e texto).

## 10. Testes que o código precisa ter
- Amigo com 2 dias sem treino não aparece; com 3 aparece.
- Amigo recém-cadastrado (menos de 2 desafios) não aparece.
- Amigo resgatado hoje por outra pessoa não aparece de novo.
- 4º resgate do dia de quem resgata é bloqueado; 4º resgate da semana para o mesmo resgatado é bloqueado.
- Resgatado com categoria "Amigos/Hive" desligada: só aparece a opção WhatsApp.
- Volta em 47 h dá recompensa; em 49 h não dá. Máximo 2 protetores por mês.
- W1 suprimido no dia do resgate.

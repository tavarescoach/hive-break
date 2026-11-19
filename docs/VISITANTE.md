# Hive Break — Visitante: joga antes do cadastro, username + código por e-mail (18/11/2026)

> Item #5 da ordem de execução (`SOCIAL_CRUZAMENTO_16.md`, seção 5 e regra 3.1).
> Decisão do Luan (18/11/2026): o cadastro passa a ser **username + código de 6 dígitos por e-mail**. O login com Google continua como alternativa, mas deixa de ser o caminho principal (muita gente trava nele). O e-mail capturado alimenta lembretes e alertas (`FUNIL_LEMBRETES.md`).
> Valores **[validar]** são padrão até decisão do Luan.

## 1. Fluxo principal (convidado por link)

1. **Abre o link do convite** (`?g=&h=&ref=`, ver `GANCHOS_CONVITE.md`). Tela: avatar e nome de quem convidou, o desafio, a duração e o placar a bater (se houver).
2. **Escolhe um username** (checagem de disponibilidade ao digitar) e responde a **triagem de saúde** (seção 4). Nesse momento o app cria uma **sessão de visitante** (usuário anônimo do Supabase), com o `ref` de quem convidou guardado.
3. **Faz o desafio** com a câmera, normalmente.
4. **Resultado** ao lado do placar de quem convidou. Botão principal: **"Salvar meu resultado"**.
5. **E-mail → código.** A pessoa digita o e-mail, recebe um **código de 6 dígitos** e digita no app. A conta vira permanente, com o mesmo username e o resultado já salvo.
6. Depois de confirmado: entra na liga (no grupo de quem convidou, se tiver vaga), ganha o protetor de convite, recebe lembretes e pode aceitar a revanche.

Texto da tela do e-mail: "Pra não perder seu resultado e sua sequência, manda um código pro seu e-mail. Sem senha." + aviso "Você vai receber lembretes curtos. Dá pra desligar quando quiser."

Alternativa sempre visível, menor: "Entrar com Google".

### 1.1 Variante: código antes de jogar **[validar]**
Configurável (`EXIGIR_EMAIL_ANTES_DO_DESAFIO`, padrão `false`). Se `true`, o passo 5 vem logo depois do passo 2. Recomendação: começar com `false` (jogar antes converte mais) e testar.

## 2. Outros caminhos
- **Entrou direto pelo site (sem convite):** mesmo fluxo, sem a tela do passo 1.
- **Já tem conta e quer entrar:** "Entrar" → e-mail → código → logado. Sem senha.
- **Visitante digita um e-mail que já tem conta:** em vez de dar erro, manda o código de login para esse e-mail e, depois de confirmado, **transfere o resultado do visitante** para a conta existente (função no servidor). O username de visitante é descartado.
- **Visitante não confirma o e-mail:** o resultado fica guardado por **7 dias** no aparelho e no servidor. Ao voltar, o app lembra: "Seu resultado de ontem ainda não está salvo." Depois de 7 dias, o usuário anônimo e os dados são apagados (rotina diária).

## 3. O que o visitante pode e não pode fazer
| Pode | Não pode (até confirmar o e-mail) |
|---|---|
| Fazer desafios com câmera | Contar pontos oficiais na liga |
| Entrar numa hive e contar no bônus de tamanho (`BONUS_HIVE.md`) | Receber lembretes |
| Ver o próprio resultado e o placar de quem convidou | Gerar convites próprios com recompensa |
| Gerar o card pós-treino | Ofensiva com mais de 1 dia (a ofensiva é guardada, mas só continua depois de confirmar) |

## 4. Triagem de saúde (antes do 1º desafio)
Três perguntas sim/não:
1. Você sente dor no peito quando faz esforço físico?
2. Você já desmaiou ou sentiu tontura forte durante exercício?
3. Algum profissional de saúde já pediu para você evitar exercício?

Se marcar "sim" em qualquer uma: "Antes de começar, vale conversar com um profissional de saúde. Por enquanto, vamos com respiração e alongamento leve." O app libera só desafios de respiração e alongamento leve. As respostas ficam no perfil e podem ser refeitas em /perfil/config.

## 5. Regras do username
- 3 a 20 caracteres; letras, números, ponto e sublinhado; sem espaço; sem diferenciar maiúscula e minúscula para unicidade.
- Lista de palavras proibidas (palavrões, ofensas) e de nomes reservados (`admin`, `hivebreak`, `suporte`, `oficial`, `luan`…).
- Sugestões automáticas quando o nome já existe (ex.: `joana` → `joana.break`, `joana_23`).
- O username pode ser trocado depois, no máximo 1 vez a cada 30 dias.

## 6. Código por e-mail
- 6 dígitos, válido por **10 minutos** **[validar]**, reenvio liberado depois de 60 s.
- No máximo 5 tentativas erradas; depois, pedir um novo código.
- Campo de código com 6 caixas, colar automático e teclado numérico (`inputmode="numeric"`, `autocomplete="one-time-code"`).
- Mensagens: "Código enviado para {email}. Confira também o spam." · "Código errado. Faltam {n} tentativas." · "Código expirado. Mandar outro?"
- Assunto do e-mail: "Seu código Hive Break: {codigo}" (o código no assunto ajuda a copiar pela notificação do celular). Corpo curto, na marca, com o código grande.

## 7. Implementação no Supabase
- **Visitante:** login anônimo do Supabase (`signInAnonymously`), com **CAPTCHA invisível (Cloudflare Turnstile)**, que a documentação do Supabase recomenda fortemente para esse tipo de login.
- **Transformar visitante em conta:** `updateUser({ email })` no usuário anônimo → o Supabase manda o código → verificar com `verifyOtp` (confirmar na documentação o `type` correto para troca de e-mail, provavelmente `email_change`). Exige ativar o "manual identity linking".
- **Login de quem já tem conta:** `signInWithOtp({ email })` + `verifyOtp({ email, token, type: 'email' })`.
- **Templates de e-mail:** os templates "Magic Link" e "Change Email Address" precisam conter `{{ .Token }}` para enviar o código de 6 dígitos em vez de link.
- **Atribuição do convite:** o `ref` é salvo no perfil do visitante no passo 2 e o "convite ativado" (20 XP + protetores) só é creditado depois de confirmar o e-mail e concluir o 1º desafio.
- **Liga:** pontos de visitante ficam pendentes e entram na liga na confirmação.

## 8. Passos manuais no painel do Supabase (o Luan faz; o Claude Code não consegue)
1. **SMTP próprio (obrigatório).** O e-mail padrão do Supabase só envia para membros da equipe do projeto e cerca de 2 mensagens por hora. Configurar em Authentication → SMTP:
   - Piloto: Gmail **contatohivebreak@gmail.com** com senha de app (exige verificação em 2 etapas na conta Google). Limite do Gmail: ~500 destinatários por dia, somando lembretes.
   - Depois do piloto: domínio próprio + serviço transacional (ex.: Resend, Brevo) com SPF, DKIM e DMARC.
2. **Limite de envio de e-mail** (Rate Limits): depois do SMTP próprio, o padrão é 30 por hora. Subir para o tamanho do piloto.
3. **Login anônimo:** ativar em Authentication → Providers. O limite padrão é 30 por hora **por IP**. Num escritório, todo mundo costuma sair pelo mesmo IP: subir esse limite antes do piloto, senão uma hive grande trava.
4. **Manual identity linking:** ativar.
5. **Turnstile:** criar a chave no Cloudflare e colar em Authentication → Bot and Abuse Protection.
6. **Email OTP expiration:** 600 s (10 min). Atenção: vale também para os outros links de e-mail.
7. **Templates:** colar os textos dos e-mails com `{{ .Token }}` (o Claude Code pode gerar o HTML).

## 9. Dados
- `profiles`: `username` (único, minúsculo), `username_trocado_em`, `ref_convite`, `triagem_respondida_em`, `triagem_restricao` (bool), `visitante` (bool).
- Rotina diária: apagar usuários anônimos com mais de 7 dias e seus dados.
- Função `migrar_visitante(anon_id, conta_id)` para o caso do e-mail já existente.
- Eventos: `visitor_started`, `username_created`, `screening_done`, `visitor_challenge_completed`, `email_code_sent`, `email_code_verified`, `visitor_converted`, `visitor_expired`.

## 10. Métricas (funil do convidado)
Link aberto → username criado → desafio iniciado → desafio concluído → código enviado → código confirmado.
Comparar com o funil anterior (login Google antes de jogar). Meta inicial: mais de 50% de quem conclui o desafio confirma o e-mail. **[validar]**

## 11. Testes
- Username: válido, curto, proibido, reservado, duplicado (com maiúsculas), sugestões.
- Triagem com "sim" libera só respiração e alongamento.
- Visitante conclui desafio → confirma e-mail → resultado e `ref` preservados; convite ativado credita quem convidou.
- E-mail já existente → login + migração do resultado.
- Código errado 5 vezes → bloqueia; código expirado → pede novo; reenvio antes de 60 s bloqueado.
- Visitante não confirmado some depois de 7 dias.
- Visitante conta no bônus de tamanho da hive, mas não na liga até confirmar.

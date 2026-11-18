# E-mails do código de 6 dígitos (docs/VISITANTE.md, seção 6)

Colar no painel do Supabase, em **Authentication → Emails → Templates**.
O código vai no assunto para dar para copiar pela notificação do celular.

| Template no Supabase | Quando sai | Assunto | Corpo (HTML) |
| --- | --- | --- | --- |
| **Magic Link** | "Entrar" com e-mail e quando o e-mail do visitante já tem conta (`signInWithOtp`) | `Seu código Hive Break: {{ .Token }}` | [`codigo-login.html`](codigo-login.html) |
| **Change Email Address** | Visitante salvando o resultado (`updateUser({ email })`) | `Seu código Hive Break: {{ .Token }}` | [`codigo-salvar-resultado.html`](codigo-salvar-resultado.html) |

Os dois só usam `{{ .Token }}` (o código). Não ponha `{{ .ConfirmationURL }}`: com o link, o
Supabase manda um link mágico em vez do código, e o app espera o código.

Confira também em **Authentication → Providers → Email**: *Email OTP length* = 6 e
*Email OTP expiration* = 600 (10 minutos).

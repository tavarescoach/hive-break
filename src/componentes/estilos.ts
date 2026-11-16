/** Classes reutilizadas. Botões têm pelo menos 48 px de altura (seção 12.5). */
export const botaoPrimario =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-mel px-5 text-lg font-black text-black active:bg-mel-forte disabled:opacity-50";
export const botaoSecundario =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-borda px-5 text-lg font-bold text-texto active:bg-superficie disabled:opacity-50";
export const cartao = "rounded-2xl border border-borda bg-superficie p-4";
export const campoTexto =
  "h-14 w-full rounded-xl border border-borda bg-superficie px-4 text-xl font-semibold text-texto placeholder:text-apagado/60";
export const sobrelinha = "text-sm font-semibold uppercase tracking-[0.18em] text-mel";
/** Cartão de opção: o input fica escondido e o rótulo inteiro é clicável. */
export const opcaoCartao =
  "flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-borda bg-superficie px-4 py-3 has-[:checked]:border-mel has-[:checked]:bg-mel/10 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-mel";

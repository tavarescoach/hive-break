/*
 * Service worker do Hive Break.
 * - Deixa o app instalável em todos os navegadores Android.
 * - Mostra os lembretes por push e abre o app no lugar certo ao tocar.
 * Não intercepta requisições nem guarda nada em cache: o app continua
 * sempre buscando a versão mais nova, e nenhuma imagem da câmera passa por aqui.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { texto: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo || "Hive Break", {
      body: dados.texto || "",
      icon: "/icones/icon-192.png",
      badge: "/icones/icon-192.png",
      // Um lembrete do mesmo gatilho substitui o anterior em vez de empilhar.
      tag: dados.gatilho || "hive-break",
      data: { url: dados.url || "/trilha", log_id: dados.log_id, assinatura: dados.assinatura },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const { url, log_id, assinatura } = evento.notification.data || {};
  const destino = new URL(url || "/trilha", self.location.origin);
  // Link de outro endereço (ex.: preview) abre no app atual, no mesmo caminho.
  const alvo = destino.origin === self.location.origin ? destino.href : new URL(destino.pathname + destino.search, self.location.origin).href;

  const registrar = log_id
    ? fetch("/api/lembretes/aberto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ log_id, assinatura }),
      }).catch(() => {})
    : Promise.resolve();

  const abrir = self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (janelas) => {
    for (const janela of janelas) {
      if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
        try {
          await janela.navigate(alvo);
          return janela.focus();
        } catch {
          break;
        }
      }
    }
    return self.clients.openWindow(alvo);
  });

  evento.waitUntil(Promise.all([registrar, abrir]));
});

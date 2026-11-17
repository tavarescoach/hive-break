/*
 * Service worker mínimo do Hive Break.
 * Existe só para o app ser instalável em todos os navegadores Android.
 * Não intercepta requisições nem guarda nada em cache: o app continua
 * sempre buscando a versão mais nova, e nenhuma imagem da câmera passa por aqui.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

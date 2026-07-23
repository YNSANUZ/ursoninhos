/* =========================================================
   Ursoninhos — service worker
   Existe por DOIS motivos:
   1. Habilitar a instalação do site como app (PWA): o Chrome só
      dispara o "beforeinstallprompt" quando há um SW com handler
      de fetch.
   2. Dar um fallback offline básico.

   Estratégia: NETWORK-FIRST. Com internet, sempre busca a versão
   fresca do servidor (o cache-busting ?v= continua valendo e nunca
   servimos arquivo velho). Sem internet, cai no que estiver em cache.
   Só mexe em requisições GET do próprio domínio — terceiros (three.js,
   fontes, imagens externas) o navegador resolve sozinho.
   ========================================================= */
const CACHE = 'ursoninhos-shell-v1';

self.addEventListener('install', () => {
  // Ativa a versão nova imediatamente, sem esperar as abas fecharem.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Limpa caches de versões antigas deste SW.
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // deixa o navegador cuidar de terceiros

  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      // Guarda uma cópia só de respostas próprias bem-sucedidas.
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone()).catch(() => {});
      }
      return fresh;
    } catch (error) {
      // Offline: tenta o cache; para navegações, cai na home salva.
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const home = await caches.match('./index.html');
        if (home) return home;
      }
      throw error;
    }
  })());
});

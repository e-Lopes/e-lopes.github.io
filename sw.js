const CACHE_NAME = 'digistats-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 🧠 HTML, CSS e JS = Network First
  // Adicionamos verificação de CSS e JS para garantir que o estilo novo carregue logo
  if (
    req.headers.get('accept')?.includes('text/html') || 
    url.pathname.endsWith('.css') || 
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)) // Se falhar a rede, usa o cache
    );
    return;
  }

  // 🎨 Outros Assets (Imagens, Ícones) = Cache First
  event.respondWith(
    caches.match(req).then(res => res || fetch(req))
  );
});

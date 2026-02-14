const CACHE_VERSION = 'v8';
const CACHE_NAME = `digistats-${CACHE_VERSION}`;

const APP_SHELL_ASSETS = [
    './',
    './index.html',
    './offline.html',
    './styles.css',
    './styles/components/utilities.css',
    './styles/components/states.css',
    './manifest.json',
    './config/app-version.js',
    './config/supabase.js',
    './config/api-client.js',
    './config/ui-state.js',
    './config/validation.js',
    './config/register-sw.js',
    './torneios/list-tournaments/calendar-view/calendar.js',
    './torneios/list-tournaments/script.js',
    './torneios/edit-tournament/modal.js',
    './icons/icons-192.png',
    './icons/icons-512.png',
    './icons/favicon/favicon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) =>
                Promise.all(APP_SHELL_ASSETS.map((asset) => cache.add(asset).catch(() => null)))
            )
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                )
            )
    );
    self.clients.claim();
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const isNavigation = request.mode === 'navigate';
    const isScriptOrStyle = request.destination === 'script' || request.destination === 'style';
    const isStaticAsset =
        request.destination === 'image' ||
        request.destination === 'font' ||
        request.destination === 'manifest';

    if (isNavigation) {
        event.respondWith(networkFirst(request, './offline.html'));
        return;
    }

    if (isScriptOrStyle) {
        event.respondWith(networkFirst(request));
        return;
    }

    if (isStaticAsset) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(networkFirst(request));
});

async function networkFirst(request, fallbackAsset) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (fallbackAsset) {
            const fallback = await cache.match(fallbackAsset);
            if (fallback) return fallback;
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) {
        cache.put(request, response.clone());
    }
    return response;
}



const CACHE_VERSION = 'v89';
const CACHE_NAME = `digistats-${CACHE_VERSION}`;

const APP_SHELL_ASSETS = [
    './',
    './index.html',
    './tools.html',
    './config/legacy-entry.js',
    './shared/workspace/tools.css',
    './shared/workspace/base.css',
    './shared/workspace/components.css',
    './shared/workspace/tournaments.css',
    './shared/workspace/details.css',
    './shared/workspace/decks.css',
    './shared/workspace/players.css',
    './shared/workspace/admin.css',
    './shared/workspace/forms.css',
    './shared/workspace/navigation.js',
    './shared/theme.css',
    './shared/data/tournaments.js',
    './shared/workspace/native.css',
    './shared/workspace/native.js',
    './demo-v2/tools.html',
    './demo-v2/deckbuilder.html',
    './demo-v2/index.html',
    './demo-v2/microfrontends.json',
    './demo-v2/mfe/shared/react.js',
    './demo-v2/mfe/shared/jsx.js',
    './demo-v2/mfe/shared/dom.js',
    './demo-v2/mfe/dashboard/remote.js',
    './demo-v2/mfe/workspace/remote.js',
    './demo-v2/mfe/studio/remote.js',
    './demo-v2/mfe/builder/remote.js',
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
    './config/tournament-utils.js',
    './config/digilab-export.js',
    './feedback/feedback.js',
    './config/register-sw.js',
    './torneios/list-tournaments/calendar-view/calendar.js',
    './torneios/tournament-ocr-files.js',
    './torneios/list-tournaments/script.js',
    './torneios/edit-tournament/modal.js',
    './icons/digimon-cwb-app-180.png',
    './icons/digimon-cwb-app-192.png',
    './icons/digimon-cwb-app-512.png',
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

    if (
        isNavigation ||
        request.destination === 'manifest' ||
        url.pathname.endsWith('/manifest.json')
    ) {
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

    try {
        const response = await fetch(request);
        if (response && response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
}

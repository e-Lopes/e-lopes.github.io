(function registerServiceWorker() {
    const isHttpContext =
        window.location.protocol === 'http:' || window.location.protocol === 'https:';
    if (!isHttpContext) return;
    if (!('serviceWorker' in navigator)) return;

    const candidates = ['/sw.js', '../../sw.js', '../sw.js', './sw.js'];
    let hasReloaded = false;

    function normalizeScope(swUrl) {
        const url = new URL(swUrl, window.location.href);
        return url.pathname.replace(/\/sw\.js$/, '/') || '/';
    }

    function showUpdateNotice() {
        const id = 'sw-update-notice';
        if (document.getElementById(id)) return;

        const notice = document.createElement('button');
        notice.id = id;
        notice.type = 'button';
        notice.textContent = 'New version available. Updating...';
        notice.style.cssText = [
            'position:fixed',
            'left:50%',
            'bottom:18px',
            'transform:translateX(-50%)',
            'z-index:10000',
            'font:600 12px/1.2 Segoe UI, sans-serif',
            'color:#fff',
            'background:#2f3a7a',
            'border:1px solid #667eea',
            'padding:10px 14px',
            'border-radius:10px',
            'box-shadow:0 8px 24px rgba(0,0,0,.3)',
            'cursor:default'
        ].join(';');
        document.body.appendChild(notice);
    }

    async function findSwUrl() {
        for (const candidate of candidates) {
            try {
                const response = await fetch(candidate, { method: 'GET', cache: 'no-store' });
                if (response.ok) return candidate;
            } catch {
                // try next candidate
            }
        }
        return null;
    }

    function attachUpdateListeners(registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateNotice();
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (hasReloaded) return;
            hasReloaded = true;
            window.location.reload();
        });
    }

    window.addEventListener('load', async () => {
        const swUrl = await findSwUrl();
        if (!swUrl) return;

        try {
            const registration = await navigator.serviceWorker.register(swUrl, {
                scope: normalizeScope(swUrl),
                updateViaCache: 'none'
            });
            attachUpdateListeners(registration);
            registration.update().catch(() => null);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    });
})();


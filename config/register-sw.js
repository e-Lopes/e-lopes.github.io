(function registerServiceWorker() {
    const isHttpContext =
        window.location.protocol === 'http:' || window.location.protocol === 'https:';
    if (!isHttpContext) return;
    if (!('serviceWorker' in navigator)) return;

    const candidates = window.location.pathname.includes('/teste/')
        ? ['../sw.js', '../../sw.js', './sw.js']
        : ['./sw.js', '../sw.js', '../../sw.js'];
    let hasReloaded = false;

    function normalizeScope(swUrl) {
        const url = new URL(swUrl, window.location.href);
        return url.pathname.replace(/\/sw\.js$/, '/') || '/';
    }

    function getVersionLabel() {
        return window.APP_VERSION || 'dev';
    }

    function renderVersionBadge() {
        const id = 'app-version-badge';
        if (document.getElementById(id)) return;

        const badge = document.createElement('div');
        badge.id = id;
        badge.textContent = `v${getVersionLabel()}`;
        badge.style.cssText = [
            'position:fixed',
            'right:10px',
            'bottom:10px',
            'z-index:9999',
            'font:600 11px/1.2 Segoe UI, sans-serif',
            'color:#fff',
            'background:rgba(20,20,20,.65)',
            'padding:6px 8px',
            'border-radius:8px',
            'backdrop-filter: blur(3px)'
        ].join(';');
        document.body.appendChild(badge);
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
        renderVersionBadge();

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


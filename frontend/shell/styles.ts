const stylesheetRequests = new Map<string, Promise<void>>();

export function loadStylesheet(path: string, version: string, asset: (path: string) => string) {
    const url = new URL(asset(path));
    url.searchParams.set('v', version);
    const key = url.href;
    const pending = stylesheetRequests.get(key);
    if (pending) return pending;

    const request = new Promise<void>((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = key;
        link.dataset.mfeStyle = path;
        link.onload = () => resolve();
        link.onerror = () => {
            link.remove();
            stylesheetRequests.delete(key);
            reject(Error('Falha ao carregar os estilos.'));
        };
        document.head.append(link);
    });
    stylesheetRequests.set(key, request);
    return request;
}

import type { Route, RouteName } from '../contracts';
export const routeNames: RouteName[] = [
    'overview',
    'tournaments',
    'meta',
    'decks',
    'players',
    'admin',
    'manage',
    'statistics',
    'posts',
    'builder'
];
export function readRoute(): Route {
    const name = location.hash.slice(1).split('?')[0];
    return {
        name:
            name === 'statistics'
                ? 'meta'
                : routeNames.includes(name as RouteName)
                  ? (name as RouteName)
                  : 'overview',
        params: new URLSearchParams(location.search)
    };
}
export function href(name: RouteName, params: Record<string, string> = {}) {
    const target = new URL(location.href);
    target.search = new URLSearchParams(params).toString();
    target.hash = name;
    return target.href;
}
export function navigate(name: RouteName, params: Record<string, string> = {}) {
    history.pushState(null, '', href(name, params));
    window.dispatchEvent(new Event('digistats:route'));
    window.scrollTo(0, 0);
}
export function subscribeRoute(listener: () => void) {
    for (const event of ['hashchange', 'popstate', 'digistats:route'])
        window.addEventListener(event, listener);
    return () => {
        for (const event of ['hashchange', 'popstate', 'digistats:route'])
            window.removeEventListener(event, listener);
    };
}

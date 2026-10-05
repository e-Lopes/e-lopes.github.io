import { useSyncExternalStore } from 'react';
import type { MicroContext, DataService, MicroHandle } from '../contracts';
import { createRoot } from 'react-dom/client';
import { Component as ReactComponent } from 'react';
import type { ComponentType, ReactNode } from 'react';
class ModuleBoundary extends ReactComponent<{ children: ReactNode }, { error: boolean }> {
    state = { error: false };
    static getDerivedStateFromError() {
        return { error: true };
    }
    render() {
        return this.state.error ? (
            <div role="alert">
                <p>Não foi possível abrir esta tela.</p>
                <button
                    className="button secondary"
                    onClick={() => this.setState({ error: false })}
                >
                    Tentar novamente
                </button>
            </div>
        ) : (
            this.props.children
        );
    }
}
export function useData(service: DataService) {
    return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
}
export function mountReact(
    Component: ComponentType<{ context: MicroContext }>,
    element: HTMLElement,
    context: MicroContext
): MicroHandle {
    const root = createRoot(element);
    root.render(
        <ModuleBoundary>
            <Component context={context} />
        </ModuleBoundary>
    );
    return {
        update(next) {
            root.render(
                <ModuleBoundary>
                    <Component context={next} />
                </ModuleBoundary>
            );
        },
        unmount() {
            root.unmount();
        }
    };
}
export function Loader({ text = 'Carregando…' }: { text?: string }) {
    return (
        <div className="mfe-loading" role="status">
            <span className="v2-loader" aria-hidden="true" />
            <p>{text}</p>
        </div>
    );
}

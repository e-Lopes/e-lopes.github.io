import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Select } from '../../shared/Select';

/* Keep the original selects and change handlers as the pagination source of truth. */
export function usePageSizeSelects() {
    const host = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const container = host.current;
        if (!container) return;
        const selector = 'select.page-size-select, select#perPageSelect';
        const controls = new Map<
            HTMLSelectElement,
            { root: Root; mount: HTMLDivElement; update(): void }
        >();
        function reconcile() {
            for (const [native, control] of controls) {
                if (!container!.contains(native)) {
                    native.removeEventListener('change', control.update);
                    control.root.unmount();
                    control.mount.remove();
                    native.classList.remove('legacy-select-native');
                    controls.delete(native);
                }
            }
            for (const native of container!.querySelectorAll<HTMLSelectElement>(selector)) {
                if (controls.has(native)) continue;
                const mount = document.createElement('div');
                mount.className = 'legacy-page-size';
                native.after(mount);
                native.classList.add('legacy-select-native');
                const root = createRoot(mount);
                function update() {
                    root.render(
                        <Select
                            label="Itens por página"
                            value={native.value}
                            disabled={native.disabled}
                            options={Array.from(native.options).map((option) => ({
                                value: option.value,
                                label: option.text
                            }))}
                            onChange={(value) => {
                                native.value = value;
                                native.dispatchEvent(new Event('change', { bubbles: true }));
                            }}
                        />
                    );
                }
                controls.set(native, { root, mount, update });
                native.addEventListener('change', update);
                update();
            }
        }
        const observer = new MutationObserver((mutations) => {
            reconcile();
            for (const mutation of mutations) {
                const element =
                    mutation.target instanceof Element
                        ? mutation.target
                        : mutation.target.parentElement;
                const native = element?.closest<HTMLSelectElement>(selector);
                if (native) controls.get(native)?.update();
            }
        });
        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'selected'],
            characterData: true
        });
        reconcile();
        return () => {
            observer.disconnect();
            for (const [native, control] of controls) {
                native.removeEventListener('change', control.update);
                control.root.unmount();
                control.mount.remove();
                native.classList.remove('legacy-select-native');
            }
        };
    }, []);
    return host;
}

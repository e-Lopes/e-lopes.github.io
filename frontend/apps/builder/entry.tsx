import { memo, useEffect, useState } from 'react';
import type { MicroContext } from '../../contracts';
import { mountReact, Loader } from '../../shared/runtime';
import { DomainForms } from './DomainForms';
import { PageHeading } from '../../shared/PageHeading';
const Forms = memo(DomainForms);
let boot: Promise<void> | null = null;
export const apiVersion = 1;
export const mount = (element: HTMLElement, context: MicroContext) =>
    mountReact(Builder, element, context);
function Builder({ context }: { context: MicroContext }) {
    const [busy, setBusy] = useState(true),
        [error, setError] = useState(''),
        [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 781px)').matches);
    useEffect(() => {
        const media = window.matchMedia('(min-width: 781px)');
        const update = () => setDesktop(media.matches);
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);
    useEffect(() => {
        if (!context.active || !desktop) return;
        let current = true;
        setBusy(true);
        setError('');
        const first = !boot;
        boot ||= (async () => {
            await context.loadScript('config/app-version.js');
            await context.loadScript('torneios/decklist-builder/script.js');
            await window.initializeDeckbuilder();
        })().catch((error) => {
            boot = null;
            throw error;
        });
        boot.then(async () => {
            if (current && !first) await window.refreshDeckbuilderContext();
        })
            .catch((error) => {
                if (current) setError(error.message);
            })
            .finally(() => {
                if (current) setBusy(false);
            });
        return () => {
            current = false;
        };
    }, [context.route, context.active, desktop]);
    const returnViews = {
        decks: 'decks',
        players: 'players',
        statistics: 'meta',
        meta: 'meta'
    } as const;
    const destination =
        returnViews[context.route.params.get('returnView') as keyof typeof returnViews] || 'manage';
    const returnParams = Object.fromEntries(context.route.params);
    returnParams.view = context.route.params.get('returnView') || 'tournaments';
    if (destination === 'meta') {
        returnParams.format = context.route.params.get('returnFormat') || returnParams.format || '';
        returnParams.period = context.route.params.get('returnPeriod') || returnParams.period || '';
        returnParams.store = context.route.params.get('returnStore') || '';
    }
    return (
        <>
            <PageHeading
                eyebrow="Decks da comunidade"
                title="Deckbuilder"
                description="Monte e registre a decklist do resultado selecionado."
            />
            <a
                className="button secondary native-back-link"
                href={context.href(destination, returnParams)}
                onClick={(e) => {
                    e.preventDefault();
                    context.navigate(destination, returnParams);
                }}
            >
                ← Voltar
            </a>
            {!desktop && (
                <section
                    className="surface builder-desktop-notice"
                    aria-label="Deckbuilder no computador"
                >
                    <h2>Abra o deckbuilder no computador</h2>
                    <p>
                        A montagem e edição de decklists estão disponíveis na versão para
                        computador.
                    </p>
                </section>
            )}
            {desktop && busy && <Loader text="Carregando catálogo de cartas…" />}
            {desktop && error && <p role="alert">{error}</p>}
            <div data-builder-root="true" hidden={!desktop}>
                <Forms />
            </div>
        </>
    );
}

import { useEffect, useState } from 'react';
import type { MicroContext } from '../../contracts';
import { useData, Loader } from '../../shared/runtime';
import { PageHeading } from '../../shared/PageHeading';
import { Portrait } from '../../shared/cards';
import { Select } from '../../shared/Select';
import { ActionMenu, Dialog, EmptyState, ListToolbar, Pagination } from '../../shared/ListPage';
import {
    cardCode,
    deckColors,
    loadDecklistIds,
    loadDecks,
    loadHistory,
    loadHistoryDecklists,
    loadPlayers,
    normalizeSearch,
    paginate,
    request,
    saveDeck,
    savePlayer,
    setActivity,
    type DeckRecord,
    type HistoryRecord,
    type PlayerRecord
} from './catalog-service';

function useRecords<T>(load: (signal: AbortSignal) => Promise<T[]>, active: boolean, key: string) {
    const [items, setItems] = useState<T[]>([]),
        [loading, setLoading] = useState(true),
        [error, setError] = useState(''),
        [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!active) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        load(controller.signal)
            .then((data) => {
                if (!controller.signal.aborted) setItems(data);
            })
            .catch((error) => {
                if (!controller.signal.aborted) setError(error.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [active, key, revision]);
    return { items, loading, error, refresh: () => setRevision((value) => value + 1) };
}
function usePageSize(key: string) {
    const [size, changeSize] = useState(() => {
        try {
            const stored = Number(localStorage.getItem(key));
            return [10, 20, 40, 80].includes(stored) ? stored : 20;
        } catch {
            return 20;
        }
    });
    return [
        size,
        (value: number) => {
            changeSize(value);
            try {
                localStorage.setItem(key, String(value));
            } catch {
                /* storage can be unavailable */
            }
        }
    ] as const;
}
function LoadError({ error, retry }: { error: string; retry(): void }) {
    return error ? (
        <div className="list-error" role="alert">
            <span>{error}</span>
            <button className="button secondary" onClick={retry}>
                Tentar novamente
            </button>
        </div>
    ) : null;
}
function Colors({ colors }: { colors?: string }) {
    return (
        <span className="catalog-colors">
            {deckColors
                .filter((color) => colors?.split(',').includes(color.code))
                .map((color) => (
                    <span key={color.code} style={{ background: color.color }} title={color.label}>
                        <span className="sr-only">{color.label}</span>
                    </span>
                ))}
        </span>
    );
}
export function PlayersPage({ context }: { context: MicroContext }) {
    const records = useRecords(loadPlayers, context.active, 'players');
    const [query, setQuery] = useState(''),
        [inactive, setInactive] = useState(false),
        [page, setPage] = useState(1),
        [size, setSize] = usePageSize('playersPageSize');
    const [selected, setSelected] = useState<PlayerRecord | null>(null),
        [editing, setEditing] = useState<Partial<PlayerRecord> | null>(null),
        [confirming, setConfirming] = useState<PlayerRecord | null>(null),
        [notice, setNotice] = useState('');
    useEffect(() => {
        setPage(1);
    }, [query, inactive, size]);
    useEffect(() => {
        if (!context.active) {
            setSelected(null);
            setEditing(null);
            setConfirming(null);
            return;
        }
        const selectedId = context.route.params.get('playerId');
        if (selectedId)
            setSelected(records.items.find((player) => String(player.id) === selectedId) || null);
    }, [context.active, context.route, records.items]);
    useEffect(() => {
        if (context.active && context.route.params.get('action') === 'create-player')
            setEditing({});
    }, [context.active, context.route]);
    const filtered = records.items.filter(
        (player) =>
            (inactive || player.is_active !== false) &&
            normalizeSearch(
                [player.name, player.bandai_nick, player.digilab_name, player.bandai_id].join(' ')
            ).includes(normalizeSearch(query))
    );
    const paging = paginate(filtered, page, size);
    const selectedPlayer = records.items.find((player) => player.id === selected?.id) || selected;
    return (
        <section className="catalog-app">
            <div className="catalog-heading">
                <PageHeading
                    eyebrow="Pessoas da comunidade"
                    title="Jogadores"
                    description="Encontre jogadores e acompanhe seus resultados."
                />
                <button className="button primary" onClick={() => setEditing({})}>
                    + Adicionar jogador
                </button>
            </div>
            <ListToolbar
                query={query}
                onQuery={setQuery}
                placeholder="Buscar nome, apelido ou ID Bandai"
                count={inactive ? 1 : 0}
                filters={
                    <label className="list-checkbox">
                        <input
                            type="checkbox"
                            checked={inactive}
                            onChange={(event) => setInactive(event.target.checked)}
                        />
                        Incluir jogadores inativos
                    </label>
                }
            />
            {notice && (
                <p className="catalog-notice" role="status">
                    {notice}
                </p>
            )}
            <LoadError error={records.error} retry={records.refresh} />
            {records.loading && !records.items.length ? (
                <Loader text="Carregando jogadores…" />
            ) : (
                <>
                    <p className="catalog-count">{filtered.length} jogadores encontrados</p>
                    <div className="catalog-list">
                        {paging.items.map((player) => (
                            <article className="catalog-row" key={player.id}>
                                <button
                                    className="catalog-item"
                                    onClick={() => setSelected(player)}
                                >
                                    <span className="catalog-avatar" aria-hidden="true">
                                        {player.name
                                            .split(/\s+/)
                                            .slice(0, 2)
                                            .map((word) => word[0])
                                            .join('')}
                                    </span>
                                    <span className="catalog-identity">
                                        <strong>{player.name}</strong>
                                        <span>
                                            {[
                                                player.bandai_nick &&
                                                    `Bandai: ${player.bandai_nick}`,
                                                player.digilab_name &&
                                                    `DigiLab: ${player.digilab_name}`
                                            ]
                                                .filter(Boolean)
                                                .join(' · ') || 'Abrir perfil e histórico'}
                                        </span>
                                    </span>
                                    {player.is_active === false && (
                                        <span className="catalog-badge">Inativo</span>
                                    )}
                                </button>
                                <ActionMenu label={player.name}>
                                    <button onClick={() => setSelected(player)}>Ver perfil</button>
                                    <button onClick={() => setEditing(player)}>
                                        Editar cadastro
                                    </button>
                                    <button onClick={() => setConfirming(player)}>
                                        {player.is_active === false
                                            ? 'Reativar jogador'
                                            : 'Inativar jogador'}
                                    </button>
                                </ActionMenu>
                            </article>
                        ))}
                    </div>
                    {!filtered.length && !records.error && (
                        <EmptyState>
                            Nenhum jogador encontrado. Tente outra busca ou inclua os inativos.
                        </EmptyState>
                    )}
                    <Pagination
                        page={paging.page}
                        pages={paging.totalPages}
                        total={filtered.length}
                        size={size}
                        onPage={setPage}
                        onSize={setSize}
                    />
                </>
            )}
            {selectedPlayer && (
                <RecordDetails
                    context={context}
                    kind="players"
                    record={selectedPlayer}
                    onClose={() => setSelected(null)}
                    onEdit={() => {
                        setSelected(null);
                        setEditing(selectedPlayer);
                    }}
                />
            )}
            {editing && (
                <PlayerForm
                    player={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        records.refresh();
                        setNotice('Cadastro salvo.');
                    }}
                />
            )}
            {confirming && (
                <ActivityDialog
                    kind="players"
                    record={confirming}
                    onClose={() => setConfirming(null)}
                    onSaved={() => {
                        setConfirming(null);
                        records.refresh();
                        setNotice('Situação do jogador atualizada.');
                    }}
                />
            )}
        </section>
    );
}
export function DecksPage({ context }: { context: MicroContext }) {
    const snapshot = useData(context.data);
    const records = useRecords((signal) => loadDecks(context, signal), context.active, 'decks');
    const [query, setQuery] = useState(''),
        [color, setColor] = useState(''),
        [format, setFormat] = useState(''),
        [onlyLists, setOnlyLists] = useState(false),
        [view, setView] = useState('list'),
        [page, setPage] = useState(1),
        [size, setSize] = usePageSize('decksPageSize');
    const [listIds, setListIds] = useState<Set<string> | null>(null),
        [listError, setListError] = useState(''),
        [listRevision, setListRevision] = useState(0);
    const [selected, setSelected] = useState<DeckRecord | null>(null),
        [editing, setEditing] = useState<Partial<DeckRecord> | null>(null),
        [confirming, setConfirming] = useState<DeckRecord | null>(null),
        [notice, setNotice] = useState('');
    useEffect(() => {
        setPage(1);
    }, [query, color, format, onlyLists, size]);
    useEffect(() => {
        if (!context.active || !onlyLists || listIds) return;
        const controller = new AbortController();
        setListError('');
        loadDecklistIds(controller.signal)
            .then(setListIds)
            .catch((error) => {
                if (!controller.signal.aborted) setListError(error.message);
            });
        return () => controller.abort();
    }, [context.active, onlyLists, listIds, listRevision]);
    useEffect(() => {
        if (!context.active) {
            setSelected(null);
            setEditing(null);
            setConfirming(null);
            return;
        }
        const id = context.route.params.get('deckId');
        if (id) setSelected(records.items.find((deck) => String(deck.id) === id) || null);
    }, [context.active, context.route, records.items]);
    useEffect(() => {
        if (context.active && context.route.params.get('action') === 'create-deck') setEditing({});
    }, [context.active, context.route]);
    const filtered = records.items.filter(
        (deck) =>
            normalizeSearch(`${deck.name} ${deck.code}`).includes(normalizeSearch(query)) &&
            (!color || deck.colors?.split(',').includes(color)) &&
            (!format ||
                snapshot.data.events.some(
                    (event) =>
                        event.format === format &&
                        event.results.some(
                            (result) => normalizeSearch(result.deck) === normalizeSearch(deck.name)
                        )
                )) &&
            (!onlyLists || !listIds || listIds.has(String(deck.id)))
    );
    const paging = paginate(filtered, page, size);
    return (
        <section className="catalog-app">
            <div className="catalog-heading">
                <PageHeading
                    eyebrow="Biblioteca da comunidade"
                    title="Decks"
                    description="Explore o catálogo, as decklists e o histórico dos decks."
                />
                <button className="button primary" onClick={() => setEditing({})}>
                    + Adicionar deck
                </button>
            </div>
            <ListToolbar
                query={query}
                onQuery={setQuery}
                placeholder="Buscar deck ou código da carta"
                count={Number(!!color) + Number(!!format) + Number(onlyLists)}
                trailing={
                    <div className="catalog-view-switch" aria-label="Visualização">
                        <button
                            className={`button secondary${view === 'list' ? ' is-active' : ''}`}
                            aria-pressed={view === 'list'}
                            onClick={() => setView('list')}
                        >
                            Lista
                        </button>
                        <button
                            className={`button secondary${view === 'grid' ? ' is-active' : ''}`}
                            aria-pressed={view === 'grid'}
                            onClick={() => setView('grid')}
                        >
                            Grade
                        </button>
                    </div>
                }
                filters={
                    <>
                        <Select
                            label="Cor"
                            value={color}
                            onChange={setColor}
                            options={[
                                { value: '', label: 'Todas as cores' },
                                ...deckColors.map((color) => ({
                                    value: color.code,
                                    label: color.label
                                }))
                            ]}
                        />
                        <Select
                            label="Formato em que foi utilizado"
                            value={format}
                            onChange={setFormat}
                            options={[
                                { value: '', label: 'Todos os formatos' },
                                ...snapshot.data.formats.map((format) => ({
                                    value: format.code,
                                    label: format.code
                                }))
                            ]}
                        />
                        <label className="list-checkbox">
                            <input
                                type="checkbox"
                                checked={onlyLists}
                                onChange={(event) => setOnlyLists(event.target.checked)}
                            />
                            Apenas com decklist
                        </label>
                        {(color || format || onlyLists) && (
                            <button
                                className="button secondary"
                                onClick={() => {
                                    setColor('');
                                    setFormat('');
                                    setOnlyLists(false);
                                }}
                            >
                                Limpar filtros
                            </button>
                        )}
                    </>
                }
            />
            {notice && (
                <p className="catalog-notice" role="status">
                    {notice}
                </p>
            )}
            <LoadError error={records.error} retry={records.refresh} />
            <LoadError error={listError} retry={() => setListRevision((value) => value + 1)} />
            {(records.loading && !records.items.length) || (onlyLists && !listIds && !listError) ? (
                <Loader text="Carregando catálogo…" />
            ) : onlyLists && !listIds && listError ? (
                <EmptyState>
                    Não foi possível aplicar o filtro de decklists. Tente novamente ou desmarque
                    esse filtro.
                </EmptyState>
            ) : (
                <>
                    <p className="catalog-count">{filtered.length} decks encontrados</p>
                    <div className={`catalog-list${view === 'grid' ? ' catalog-grid' : ''}`}>
                        {paging.items.map((deck) => (
                            <article className="catalog-row" key={deck.id}>
                                <button className="catalog-item" onClick={() => setSelected(deck)}>
                                    <Portrait image={deck.image} />
                                    <span className="catalog-identity">
                                        <strong>{deck.name}</strong>
                                        <span>{deck.code || 'Código não identificado'}</span>
                                    </span>
                                    <Colors colors={deck.colors} />
                                </button>
                                <ActionMenu label={deck.name}>
                                    <button onClick={() => setSelected(deck)}>Ver detalhes</button>
                                    <button onClick={() => setEditing(deck)}>Editar deck</button>
                                    <button onClick={() => setConfirming(deck)}>
                                        Inativar deck
                                    </button>
                                </ActionMenu>
                            </article>
                        ))}
                    </div>
                    {!filtered.length && !records.error && (
                        <EmptyState>
                            Nenhum deck encontrado. Tente outra busca ou limpe os filtros.
                        </EmptyState>
                    )}
                    <Pagination
                        page={paging.page}
                        pages={paging.totalPages}
                        total={filtered.length}
                        size={size}
                        onPage={setPage}
                        onSize={setSize}
                    />
                </>
            )}
            {selected && (
                <RecordDetails
                    context={context}
                    kind="decks"
                    record={selected}
                    onClose={() => setSelected(null)}
                    onEdit={() => {
                        setSelected(null);
                        setEditing(selected);
                    }}
                />
            )}
            {editing && (
                <DeckForm
                    context={context}
                    deck={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        records.refresh();
                        setListIds(null);
                        setNotice('Deck salvo.');
                    }}
                />
            )}
            {confirming && (
                <ActivityDialog
                    kind="decks"
                    record={confirming}
                    onClose={() => setConfirming(null)}
                    onSaved={() => {
                        setConfirming(null);
                        records.refresh();
                        setNotice('Deck inativado. O histórico foi preservado.');
                    }}
                />
            )}
        </section>
    );
}
function PlayerForm({
    player,
    onClose,
    onSaved
}: {
    player: Partial<PlayerRecord>;
    onClose(): void;
    onSaved(): void;
}) {
    const [values, setValues] = useState(player),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const fields = [
        ['name', 'Nome', true],
        ['bandai_nick', 'Apelido Bandai', false],
        ['digilab_name', 'Nome no DigiLab', false],
        ['bandai_id', 'ID Bandai', false]
    ] as const;
    return (
        <Dialog
            title={player.id ? 'Editar jogador' : 'Adicionar jogador'}
            onClose={onClose}
            busy={busy}
        >
            <form
                className="catalog-form"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError('');
                    try {
                        await savePlayer(values);
                        onSaved();
                    } catch (error) {
                        setError((error as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {fields.map(([field, label, required]) => (
                    <label key={field}>
                        {label}
                        {required && ' *'}
                        <input
                            value={String(values[field] || '')}
                            required={required}
                            minLength={required ? 2 : undefined}
                            disabled={busy}
                            onChange={(event) =>
                                setValues({ ...values, [field]: event.target.value })
                            }
                        />
                    </label>
                ))}
                {error && (
                    <p className="list-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="catalog-form-actions">
                    <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button className="button primary" disabled={busy}>
                        {busy ? 'Salvando…' : 'Salvar jogador'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
function DeckForm({
    context,
    deck,
    onClose,
    onSaved
}: {
    context: MicroContext;
    deck: Partial<DeckRecord>;
    onClose(): void;
    onSaved(): void;
}) {
    const [name, setName] = useState(deck.name || ''),
        [code, setCode] = useState(deck.code || cardCode(deck.image || '')),
        [colors, setColors] = useState(deck.colors?.split(',') || []),
        [family, setFamily] = useState(deck.family_id || ''),
        [families, setFamilies] = useState<{ id: string; name: string }[] | null>(null),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [familyError, setFamilyError] = useState('');
    useEffect(() => {
        if (!deck.id) return;
        const controller = new AbortController();
        request<{ id: string; name: string }[]>(
            '/rest/v1/deck_families?select=id,name,is_active&order=name.asc',
            { signal: controller.signal }
        )
            .then(setFamilies)
            .catch((error) => {
                if (!controller.signal.aborted)
                    setFamilyError(
                        'Não foi possível carregar as famílias. A família atual será mantida.'
                    );
            });
        return () => controller.abort();
    }, [deck.id]);
    return (
        <Dialog title={deck.id ? 'Editar deck' : 'Adicionar deck'} onClose={onClose} busy={busy}>
            <form
                className="catalog-form"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError('');
                    try {
                        await saveDeck(
                            context,
                            {
                                id: deck.id,
                                name,
                                code,
                                colors: deckColors
                                    .filter((color) => colors.includes(color.code))
                                    .map((color) => color.code)
                                    .join(','),
                                family_id: family || null
                            },
                            families !== null
                        );
                        onSaved();
                    } catch (error) {
                        setError((error as Error).message);
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <label>
                    Nome do deck *
                    <input
                        value={name}
                        required
                        minLength={2}
                        disabled={busy}
                        onChange={(event) => setName(event.target.value)}
                    />
                </label>
                <label>
                    Código da carta *
                    <input
                        value={code}
                        required
                        disabled={busy}
                        placeholder="BT26-001"
                        onChange={(event) => setCode(event.target.value.toUpperCase())}
                    />
                    <small>A imagem será obtida a partir do código da carta.</small>
                </label>
                <fieldset className="catalog-color-picker">
                    <legend>Cores do deck</legend>
                    {deckColors.map((color) => (
                        <button
                            key={color.code}
                            type="button"
                            disabled={busy}
                            style={{ '--color': color.color } as React.CSSProperties}
                            className={colors.includes(color.code) ? 'is-selected' : ''}
                            aria-pressed={colors.includes(color.code)}
                            onClick={() =>
                                setColors(
                                    colors.includes(color.code)
                                        ? colors.filter((item) => item !== color.code)
                                        : [...colors, color.code]
                                )
                            }
                        >
                            <span />
                            {color.label}
                        </button>
                    ))}
                </fieldset>
                {deck.id && (
                    <Select
                        label="Família"
                        disabled={busy || !families}
                        value={family}
                        onChange={setFamily}
                        options={[
                            {
                                value: '',
                                label: families ? 'Nenhuma família' : 'Carregando famílias…'
                            },
                            ...(families || []).map((family) => ({
                                value: String(family.id),
                                label: family.name
                            }))
                        ]}
                    />
                )}
                {familyError && <p role="status">{familyError}</p>}
                {error && (
                    <p className="list-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="catalog-form-actions">
                    <button
                        type="button"
                        className="button secondary"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button className="button primary" disabled={busy}>
                        {busy ? 'Salvando…' : 'Salvar deck'}
                    </button>
                </div>
            </form>
        </Dialog>
    );
}
function ActivityDialog({
    kind,
    record,
    onClose,
    onSaved
}: {
    kind: 'players' | 'decks';
    record: PlayerRecord | DeckRecord;
    onClose(): void;
    onSaved(): void;
}) {
    const [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const activate = 'is_active' in record && record.is_active === false;
    return (
        <Dialog
            title={`${activate ? 'Reativar' : 'Inativar'} ${kind === 'players' ? 'jogador' : 'deck'}`}
            onClose={onClose}
            busy={busy}
        >
            <p>
                {activate ? 'Reativar' : 'Inativar'} <strong>{record.name}</strong>?
            </p>
            <p className="muted">O histórico de torneios será preservado.</p>
            {error && (
                <p role="alert" className="list-error">
                    {error}
                </p>
            )}
            <div className="catalog-form-actions">
                <button className="button secondary" disabled={busy} onClick={onClose}>
                    Cancelar
                </button>
                <button
                    className="button primary"
                    disabled={busy}
                    onClick={async () => {
                        setBusy(true);
                        try {
                            await setActivity(kind, record.id, activate);
                            onSaved();
                        } catch (error) {
                            setError((error as Error).message);
                        } finally {
                            setBusy(false);
                        }
                    }}
                >
                    {busy ? 'Salvando…' : activate ? 'Reativar' : 'Inativar'}
                </button>
            </div>
        </Dialog>
    );
}
function RecordDetails({
    context,
    kind,
    record,
    onClose,
    onEdit
}: {
    context: MicroContext;
    kind: 'players' | 'decks';
    record: PlayerRecord | DeckRecord;
    onClose(): void;
    onEdit(): void;
}) {
    const [tab, setTab] = useState(kind === 'decks' ? 'history' : 'info');
    const history = useRecords(
        (signal) => loadHistory(kind, record.id, signal),
        tab !== 'info',
        `${kind}:${record.id}`
    );
    const player = record as PlayerRecord,
        deck = record as DeckRecord;
    return (
        <Dialog
            title={record.name}
            onClose={onClose}
            wide
            headerContent={
                kind === 'decks' ? (
                    <div className="catalog-deck-header-group">
                        <div className="catalog-deck-header">
                            <Portrait image={deck.image} />
                            <div>
                                <h2>{deck.name}</h2>
                                <div className="catalog-deck-header-meta">
                                    <span>{deck.code || 'Código não identificado'}</span>
                                    <Colors colors={deck.colors} />
                                </div>
                            </div>
                        </div>
                        <nav
                            className="catalog-tabs catalog-deck-header-actions"
                            aria-label="Detalhes do deck"
                        >
                            {[
                                ['history', 'Histórico'],
                                ['lists', 'Decklists']
                            ].map(([value, label]) => (
                                <button
                                    key={value}
                                    className={`button secondary${tab === value ? ' is-active' : ''}`}
                                    aria-pressed={tab === value}
                                    onClick={() => setTab(value)}
                                >
                                    {label}
                                </button>
                            ))}
                            <button className="button secondary" onClick={onEdit}>
                                Editar cadastro
                            </button>
                        </nav>
                    </div>
                ) : undefined
            }
        >
            {kind === 'players' && (
                <nav className="catalog-tabs" aria-label="Detalhes">
                    {[
                        ...(kind === 'players' ? [['info', 'Informações']] : []),
                        ['history', 'Histórico'],
                    ].map(([value, label]) => (
                        <button
                            key={value}
                            className={`button secondary${tab === value ? ' is-active' : ''}`}
                            aria-pressed={tab === value}
                            onClick={() => setTab(value)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
            )}
            {tab === 'info' && (
                <div className="catalog-detail-summary">
                    <div className="catalog-detail-info">
                        {kind === 'decks' && <Portrait image={deck.image} />}
                        <dl>
                            {(kind === 'players'
                                ? [
                                      ['Nome', player.name],
                                      ['Apelido Bandai', player.bandai_nick],
                                      ['Nome no DigiLab', player.digilab_name],
                                      ['ID Bandai', player.bandai_id],
                                      ['Situação', player.is_active === false ? 'Inativo' : 'Ativo']
                                  ]
                                : [
                                      ['Deck', deck.name],
                                      ['Código', deck.code || 'Não identificado']
                                  ]
                            ).map(([label, value]) => (
                                <div key={label}>
                                    <dt>{label}</dt>
                                    <dd>{value || 'Não informado'}</dd>
                                </div>
                            ))}
                        </dl>
                        {kind === 'decks' && <Colors colors={deck.colors} />}
                    </div>
                    <button className="button secondary" onClick={onEdit}>
                        Editar cadastro
                    </button>
                </div>
            )}
            {tab !== 'info' && (
                <>
                    {kind === 'decks' && tab === 'history' && (
                        <h3 className="catalog-history-heading">Histórico de torneios</h3>
                    )}
                    <LoadError error={history.error} retry={history.refresh} />
                    {history.loading ? (
                        <Loader text="Carregando histórico…" />
                    ) : (
                        <HistoryList
                            rows={history.items}
                            context={context}
                            kind={kind}
                            name={record.name}
                            recordId={String(record.id)}
                            showLists={tab === 'lists'}
                        />
                    )}
                </>
            )}
        </Dialog>
    );
}
function HistoryList({
    rows,
    context,
    kind,
    name,
    showLists,
    recordId
}: {
    rows: HistoryRecord[];
    context: MicroContext;
    kind: 'players' | 'decks';
    name: string;
    showLists: boolean;
    recordId: string;
}) {
    const visible = showLists
        ? rows.filter((row) => row.decklists?.length || row.decklist || row.decklist_link)
        : rows;
    if (showLists && !visible.length)
        return (
            <EmptyState>
                Nenhuma decklist registrada. Abra um resultado na aba Histórico para cadastrar.
            </EmptyState>
        );
    if (!rows.length)
        return (
            <EmptyState>
                Nenhum resultado registrado para este {kind === 'players' ? 'jogador' : 'deck'}.
            </EmptyState>
        );
    return (
        <div className="catalog-history">
            <p className="muted">
                {showLists
                    ? `${visible.length} resultados com decklist.`
                    : `Últimos ${rows.length} resultados.`}
            </p>
            {visible.map((row) => (
                <HistoryEntry
                    key={row.id}
                    row={row}
                    context={context}
                    kind={kind}
                    name={name}
                    recordId={recordId}
                />
            ))}
        </div>
    );
}
function HistoryEntry({
    row,
    context,
    kind,
    name,
    recordId
}: {
    row: HistoryRecord;
    context: MicroContext;
    kind: 'players' | 'decks';
    name: string;
    recordId: string;
}) {
    const [open, setOpen] = useState(false);
    const lists = useRecords(
        (signal) => loadHistoryDecklists(row.id, signal),
        open,
        String(row.id)
    );
    const matches = context.data
        .getSnapshot()
        .data.events.filter(
            (event) => event.isoDate === row.tournament_date && event.store === row.store?.name
        );
    const tournamentId = row.tournament_id
        ? String(row.tournament_id)
        : matches.length === 1
          ? matches[0].id
          : '';
    const params = {
        resultId: String(row.id),
        ...(tournamentId ? { tournamentId, returnTournamentId: tournamentId } : {}),
        returnView: kind,
        ...(kind === 'players' ? { playerId: recordId } : { deckId: recordId }),
        deck: row.deck?.name || (kind === 'decks' ? name : ''),
        player: row.player?.name || (kind === 'players' ? name : ''),
        store: row.store?.name || '',
        date: row.tournament_date
    };
    return (
        <article className="catalog-history-entry">
            <div className="catalog-history-row">
                <span className={`catalog-placement rank-${row.placement}`}>{row.placement}º</span>
                <div>
                    <strong>
                        {kind === 'players'
                            ? row.deck?.name || 'Deck não informado'
                            : row.player?.name || 'Jogador não informado'}
                    </strong>
                    <span>
                        {row.store?.name || 'Loja'} ·{' '}
                        {window.liveData.displayDate(row.tournament_date)}
                    </span>
                </div>
                <button
                    className="button secondary"
                    aria-expanded={open}
                    onClick={() => setOpen(!open)}
                >
                    {open ? 'Fechar' : 'Decklist'}
                </button>
                {tournamentId && (
                    <button
                        className="button secondary"
                        onClick={() =>
                            context.navigate('tournaments', { tournament: tournamentId })
                        }
                    >
                        Torneio ↗
                    </button>
                )}
            </div>
            {open && (
                <div className="catalog-history-cards">
                    <LoadError error={lists.error} retry={lists.refresh} />
                    {lists.loading ? (
                        <Loader text="Carregando decklist…" />
                    ) : (
                        <>
                            {lists.items.flatMap((list) => list.decklist_cards || []).length ? (
                                <div className="catalog-card-grid">
                                    {lists.items
                                        .flatMap((list) => list.decklist_cards || [])
                                        .sort((a, b) => a.position - b.position)
                                        .map((card) => (
                                            <figure key={card.card_code}>
                                                <img
                                                    src={`https://images.digimoncard.io/images/cards/${card.card_code}.webp`}
                                                    alt={card.card_code}
                                                    loading="lazy"
                                                />
                                                <figcaption>
                                                    {card.qty} × {card.card_code}
                                                </figcaption>
                                            </figure>
                                        ))}
                                </div>
                            ) : (
                                <p className="muted">
                                    {row.decklist || row.decklist_link
                                        ? 'Decklist legada disponível no editor.'
                                        : 'Decklist ainda não registrada.'}
                                </p>
                            )}
                            <button
                                className="button primary"
                                onClick={() => context.navigate('builder', params)}
                            >
                                Abrir no deckbuilder ↗
                            </button>
                        </>
                    )}
                </div>
            )}
        </article>
    );
}

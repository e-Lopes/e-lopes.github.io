import { useEffect, useState } from 'react';
import type { MicroContext } from '../../contracts';
import { useData, Loader } from '../../shared/runtime';
import { PageHeading } from '../../shared/PageHeading';
import { Portrait, StoreLogo } from '../../shared/cards';
import { Select } from '../../shared/Select';
import { EmptyState, Pagination } from '../../shared/ListPage';
import {
    loadBuilderResults,
    normalizeSearch,
    paginate,
    type BuilderResultRecord
} from './catalog-service';

export function DecksPage({ context }: { context: MicroContext }) {
    const { data } = useData(context.data);
    const [rows, setRows] = useState<BuilderResultRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [player, setPlayer] = useState('');
    const [store, setStore] = useState('');
    const [date, setDate] = useState('');
    const [tournament, setTournament] = useState('');
    const [tournamentId, setTournamentId] = useState(
        context.route.params.get('tournamentId') ||
            context.route.params.get('returnTournamentId') ||
            ''
    );
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(20);
    useEffect(() => {
        const id =
            context.route.params.get('tournamentId') ||
            context.route.params.get('returnTournamentId');
        if (id) setTournamentId(id);
    }, [context.route]);
    useEffect(() => {
        if (!context.active) return;
        const controller = new AbortController();
        setLoading(true);
        setError('');
        loadBuilderResults(controller.signal)
            .then((items) => {
                if (!controller.signal.aborted) setRows(items);
            })
            .catch((e) => {
                if (!controller.signal.aborted) setError(e.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [context.active, revision]);
    useEffect(() => setPage(1), [player, store, date, tournament, tournamentId, status, size]);
    const events = [...data.events].sort(
        (a, b) => b.isoDate.localeCompare(a.isoDate) || a.store.localeCompare(b.store)
    );
    const indexed = rows.flatMap((row) => {
        const matches = row.tournament_id
            ? events.filter((event) => event.id === String(row.tournament_id))
            : events.filter(
                  (event) =>
                      event.storeId === String(row.store_id) &&
                      event.isoDate === row.tournament_date
              );
        // A legacy result can be linked only when its tournament is unambiguous.
        if (matches.length !== 1) return [];
        return [
            {
                row,
                event: matches[0],
                hasList: Boolean(row.decklists?.length || row.decklist)
            }
        ];
    });
    const filtered = indexed.filter(
        ({ row, event, hasList }) =>
            (!tournamentId || event.id === tournamentId) &&
            (!store || event.store === store) &&
            (!date || event.isoDate === date) &&
            normalizeSearch(
                [row.player?.name, row.player?.bandai_id, row.player?.digilab_name].join(' ')
            ).includes(normalizeSearch(player)) &&
            normalizeSearch(
                [event.title, event.store, event.date, event.isoDate, event.format].join(' ')
            ).includes(normalizeSearch(tournament)) &&
            (!status || (status === 'existing' ? hasList : !hasList))
    );
    const paging = paginate(filtered, page, size);
    return (
        <section className="catalog-app">
            <PageHeading
                eyebrow="Listas da comunidade"
                title="Deckbuilder"
                description="Encontre um resultado para criar ou editar a lista."
            />
            <div className="catalog-builder-filters">
                <label>
                    Jogador
                    <input
                        list="builder-player-options"
                        value={player}
                        onChange={(e) => setPlayer(e.target.value)}
                        placeholder="Nome, apelido ou ID Bandai"
                    />
                </label>
                <Select
                    label="Loja"
                    value={store}
                    onChange={(value) => {
                        setStore(value);
                        setTournamentId('');
                    }}
                    options={[
                        { value: '', label: 'Todas as lojas' },
                        ...[...new Set(events.map((event) => event.store))]
                            .sort()
                            .map((name) => ({ value: name, label: name }))
                    ]}
                />
                <label>
                    Data do torneio
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                            setDate(e.target.value);
                            setTournamentId('');
                        }}
                    />
                </label>
                <label>
                    Buscar torneio
                    <input
                        value={tournament}
                        onChange={(e) => setTournament(e.target.value)}
                        placeholder="Loja, data, nome ou formato"
                    />
                </label>
                <Select
                    label="Torneio"
                    value={tournamentId}
                    onChange={setTournamentId}
                    options={[
                        { value: '', label: 'Todos os torneios' },
                        ...events
                            .filter(
                                (event) =>
                                    (!store || event.store === store) &&
                                    (!date || event.isoDate === date) &&
                                    normalizeSearch(
                                        [
                                            event.title,
                                            event.store,
                                            event.date,
                                            event.isoDate,
                                            event.format
                                        ].join(' ')
                                    ).includes(normalizeSearch(tournament))
                            )
                            .map((event) => ({
                                value: event.id,
                                label: `${event.date} · ${event.store} · ${event.title} · ${event.format}`
                            }))
                    ]}
                />
                <Select
                    label="Lista"
                    value={status}
                    onChange={setStatus}
                    options={[
                        { value: '', label: 'Todas' },
                        { value: 'existing', label: 'Com lista — editar' },
                        { value: 'missing', label: 'Sem lista — criar' }
                    ]}
                />
                <button
                    className="button secondary"
                    onClick={() => {
                        setPlayer('');
                        setStore('');
                        setDate('');
                        setTournament('');
                        setTournamentId('');
                        setStatus('');
                    }}
                >
                    Limpar filtros
                </button>
            </div>
            <datalist id="builder-player-options">
                {[...new Set(indexed.map(({ row }) => row.player?.name).filter(Boolean))]
                    .sort()
                    .map((name) => (
                        <option key={name} value={name} />
                    ))}
            </datalist>
            {error && (
                <div className="list-error" role="alert">
                    <span>{error}</span>
                    <button className="button secondary" onClick={() => setRevision((v) => v + 1)}>
                        Tentar novamente
                    </button>
                </div>
            )}
            {loading ? (
                <Loader text="Carregando resultados…" />
            ) : (
                !error && (
                    <>
                        <div className="catalog-table-scroll">
                            <table className="catalog-decks-table">
                                <thead>
                                    <tr>
                                        <th>Pos.</th>
                                        <th>Jogador</th>
                                        <th>Deck</th>
                                        <th>Torneio</th>
                                        <th>Lista</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paging.items.map(({ row, event, hasList }) => (
                                        <tr key={row.id}>
                                            <td>{row.placement > 0 ? `${row.placement}º` : '—'}</td>
                                            <th>{row.player?.name || 'Jogador não informado'}</th>
                                            <td>
                                                <span className="catalog-builder-deck">
                                                    <Portrait
                                                        image={
                                                            row.deck?.deck_images?.[0]?.image_url
                                                        }
                                                    />
                                                    <strong>
                                                        {row.deck?.name || 'Deck não informado'}
                                                    </strong>
                                                </span>
                                            </td>
                                            <td>
                                                <span className="catalog-builder-store">
                                                    <StoreLogo
                                                        logo={event.logo}
                                                        name={event.store}
                                                    />
                                                    <strong>{event.store}</strong>
                                                </span>
                                                <br />
                                                <span className="muted">
                                                    {event.date} · {event.title} · {event.format}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="button secondary"
                                                    onClick={() =>
                                                        context.navigate('builder', {
                                                            resultId: row.id,
                                                            tournamentId: event.id,
                                                            returnTournamentId: event.id,
                                                            returnView: 'decks',
                                                            deck: row.deck?.name || '',
                                                            player: row.player?.name || '',
                                                            store: event.store,
                                                            date: event.isoDate,
                                                            format: event.format
                                                        })
                                                    }
                                                >
                                                    {hasList ? 'Editar lista ↗' : 'Criar lista ↗'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {!filtered.length && (
                            <EmptyState>Nenhum resultado encontrado. Ajuste os filtros.</EmptyState>
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
                )
            )}
        </section>
    );
}

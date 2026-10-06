export function MetaProfileSummary({
    count,
    share,
    players,
    titles
}: {
    count: number;
    share: string;
    players: number;
    titles: number;
}) {
    return (
        <dl className="meta-profile-summary">
            <div>
                <dt>Participações</dt>
                <dd>{count}</dd>
            </div>
            <div>
                <dt>Meta</dt>
                <dd>{share}</dd>
            </div>
            <div>
                <dt>Jogadores</dt>
                <dd>{players}</dd>
            </div>
            <div>
                <dt>Títulos</dt>
                <dd>{titles}</dd>
            </div>
        </dl>
    );
}

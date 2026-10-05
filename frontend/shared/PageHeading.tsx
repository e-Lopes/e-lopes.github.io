export function PageHeading({
    eyebrow,
    title,
    description
}: {
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <div className="page-heading">
            <span className="overview-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
        </div>
    );
}

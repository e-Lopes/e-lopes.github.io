import { orderedDeckColors } from '../apps/workspace/catalog-service';
import './deck-colors.css';

export function DeckColors({ colors }: { colors: string }) {
    const selected = orderedDeckColors(colors);
    if (!selected.length) return null;
    return (
        <span className="deck-color-dots">
            {selected.map((color) => (
                <span
                    key={color.code}
                    role="img"
                    aria-label={color.label}
                    title={color.label}
                    style={{ background: color.color }}
                />
            ))}
        </span>
    );
}

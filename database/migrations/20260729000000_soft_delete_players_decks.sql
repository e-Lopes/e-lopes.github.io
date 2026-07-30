-- Preserve players and decks referenced by tournament history when they are removed
-- from the management screens.
ALTER TABLE public.players
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.decks
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_players_is_active
    ON public.players (is_active);

CREATE INDEX IF NOT EXISTS idx_decks_is_active
    ON public.decks (is_active);

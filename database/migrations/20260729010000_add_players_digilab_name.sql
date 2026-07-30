ALTER TABLE public.players
    ADD COLUMN IF NOT EXISTS digilab_name text;

CREATE INDEX IF NOT EXISTS idx_players_digilab_name
    ON public.players (lower(digilab_name))
    WHERE digilab_name IS NOT NULL;

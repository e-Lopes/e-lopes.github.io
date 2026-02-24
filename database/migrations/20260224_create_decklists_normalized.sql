-- Normalized decklist storage for tournament results.
-- Safe to run multiple times.

DO $$
DECLARE
    tr_id_type text;
BEGIN
    SELECT a.atttypid::regtype::text
      INTO tr_id_type
      FROM pg_attribute a
     WHERE a.attrelid = 'public.tournament_results'::regclass
       AND a.attname = 'id'
       AND a.attnum > 0
       AND NOT a.attisdropped;

    IF tr_id_type IS NULL THEN
        RAISE EXCEPTION 'Could not detect public.tournament_results.id type.';
    END IF;

    IF to_regclass('public.decklists') IS NULL THEN
        EXECUTE format(
            'CREATE TABLE public.decklists (
                id bigserial PRIMARY KEY,
                tournament_result_id %s NOT NULL,
                source text NOT NULL DEFAULT ''builder'',
                created_at timestamptz NOT NULL DEFAULT timezone(''utc'', now()),
                updated_at timestamptz NOT NULL DEFAULT timezone(''utc'', now()),
                CONSTRAINT uq_decklists_tournament_result UNIQUE (tournament_result_id),
                CONSTRAINT fk_decklists_tournament_result
                    FOREIGN KEY (tournament_result_id)
                    REFERENCES public.tournament_results(id)
                    ON DELETE CASCADE
            )',
            tr_id_type
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.decklist_cards (
    id bigserial PRIMARY KEY,
    decklist_id bigint NOT NULL
        REFERENCES public.decklists(id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position > 0),
    card_code text NOT NULL,
    qty integer NOT NULL CHECK (qty BETWEEN 1 AND 4),
    card_type text,
    card_level smallint,
    is_digi_egg boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.decklist_cards
    ADD COLUMN IF NOT EXISTS card_type text;

ALTER TABLE public.decklist_cards
    ADD COLUMN IF NOT EXISTS card_level smallint;

ALTER TABLE public.decklist_cards
    ADD COLUMN IF NOT EXISTS is_digi_egg boolean NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'uq_decklist_cards_position'
           AND conrelid = 'public.decklist_cards'::regclass
    ) THEN
        ALTER TABLE public.decklist_cards
            ADD CONSTRAINT uq_decklist_cards_position UNIQUE (decklist_id, position);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'uq_decklist_cards_code'
           AND conrelid = 'public.decklist_cards'::regclass
    ) THEN
        ALTER TABLE public.decklist_cards
            ADD CONSTRAINT uq_decklist_cards_code UNIQUE (decklist_id, card_code);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_decklists_tournament_result_id
    ON public.decklists (tournament_result_id);

CREATE INDEX IF NOT EXISTS idx_decklist_cards_decklist_position
    ON public.decklist_cards (decklist_id, position);

CREATE INDEX IF NOT EXISTS idx_decklist_cards_decklist_card_code
    ON public.decklist_cards (decklist_id, card_code);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_decklists_updated_at ON public.decklists;
CREATE TRIGGER trg_touch_decklists_updated_at
BEFORE UPDATE ON public.decklists
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_decklist_cards_updated_at ON public.decklist_cards;
CREATE TRIGGER trg_touch_decklist_cards_updated_at
BEFORE UPDATE ON public.decklist_cards
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.decklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decklist_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous select decklists" ON public.decklists;
CREATE POLICY "Allow anonymous select decklists" ON public.decklists
    FOR SELECT TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous insert decklists" ON public.decklists;
CREATE POLICY "Allow anonymous insert decklists" ON public.decklists
    FOR INSERT TO anon
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update decklists" ON public.decklists;
CREATE POLICY "Allow anonymous update decklists" ON public.decklists
    FOR UPDATE TO anon
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous delete decklists" ON public.decklists;
CREATE POLICY "Allow anonymous delete decklists" ON public.decklists
    FOR DELETE TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous select decklist cards" ON public.decklist_cards;
CREATE POLICY "Allow anonymous select decklist cards" ON public.decklist_cards
    FOR SELECT TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous insert decklist cards" ON public.decklist_cards;
CREATE POLICY "Allow anonymous insert decklist cards" ON public.decklist_cards
    FOR INSERT TO anon
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update decklist cards" ON public.decklist_cards;
CREATE POLICY "Allow anonymous update decklist cards" ON public.decklist_cards
    FOR UPDATE TO anon
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous delete decklist cards" ON public.decklist_cards;
CREATE POLICY "Allow anonymous delete decklist cards" ON public.decklist_cards
    FOR DELETE TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

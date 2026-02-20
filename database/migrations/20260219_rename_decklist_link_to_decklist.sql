DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tournament_results'
          AND column_name = 'decklist_link'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tournament_results'
          AND column_name = 'decklist'
    ) THEN
        ALTER TABLE public.tournament_results
            RENAME COLUMN decklist_link TO decklist;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tournament_results'
          AND column_name = 'decklist'
    ) THEN
        ALTER TABLE public.tournament_results
            ADD COLUMN decklist text;
    END IF;
END $$;

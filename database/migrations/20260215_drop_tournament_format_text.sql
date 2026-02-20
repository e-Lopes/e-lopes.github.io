-- Phase 2 cleanup: keep only tournament.format_id and remove legacy text column.
-- Run only after frontend is using format_id as primary source.

BEGIN;

DROP TRIGGER IF EXISTS trg_sync_tournament_format_columns ON public.tournament;
DROP FUNCTION IF EXISTS public.sync_tournament_format_columns();

ALTER TABLE public.tournament
DROP CONSTRAINT IF EXISTS tournament_format_fkey;

DROP INDEX IF EXISTS idx_tournament_format;

ALTER TABLE public.tournament
DROP COLUMN IF EXISTS format;

COMMIT;

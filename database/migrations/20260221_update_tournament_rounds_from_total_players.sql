BEGIN;

ALTER TABLE public.tournament
ADD COLUMN IF NOT EXISTS rounds smallint;

UPDATE public.tournament
SET rounds = CASE
    WHEN COALESCE(total_players, 0) <= 8 THEN 3
    WHEN total_players >= 9 THEN 4
    ELSE rounds
END;

COMMIT;

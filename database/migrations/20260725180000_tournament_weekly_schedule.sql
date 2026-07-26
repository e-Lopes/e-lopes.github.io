-- Administrative weekly defaults used to speed up tournament registration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tournament_weekly_schedule (
    weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tournament_weekly_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read tournament weekly schedule" ON public.tournament_weekly_schedule;
CREATE POLICY "Public read tournament weekly schedule"
    ON public.tournament_weekly_schedule FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert tournament weekly schedule" ON public.tournament_weekly_schedule;
CREATE POLICY "Public insert tournament weekly schedule"
    ON public.tournament_weekly_schedule FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public update tournament weekly schedule" ON public.tournament_weekly_schedule;
CREATE POLICY "Public update tournament weekly schedule"
    ON public.tournament_weekly_schedule FOR UPDATE TO anon, authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public delete tournament weekly schedule" ON public.tournament_weekly_schedule;
CREATE POLICY "Public delete tournament weekly schedule"
    ON public.tournament_weekly_schedule FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_weekly_schedule TO anon, authenticated;
GRANT ALL ON public.tournament_weekly_schedule TO service_role;

-- Initial operational schedule. ON CONFLICT preserves an existing admin choice.
INSERT INTO public.tournament_weekly_schedule (weekday, store_id)
SELECT defaults.weekday, stores.id
FROM (
    VALUES
        (1::smallint, '%taverna%'),
        (3::smallint, '%gladiator%'),
        (4::smallint, '%meruru%'),
        (5::smallint, '%meruru%'),
        (6::smallint, '%rei das cartinhas%')
) AS defaults(weekday, store_pattern)
JOIN LATERAL (
    SELECT id FROM public.stores
    WHERE lower(name) LIKE defaults.store_pattern
    ORDER BY name LIMIT 1
) AS stores ON true
ON CONFLICT (weekday) DO NOTHING;

COMMIT;

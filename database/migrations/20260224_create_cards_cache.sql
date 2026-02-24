CREATE TABLE IF NOT EXISTS public.cards_cache (
    card_code text PRIMARY KEY,
    id text NOT NULL,
    name text NOT NULL,
    pack text,
    color text,
    type text,
    card_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_cards_cache_updated_at ON public.cards_cache (updated_at DESC);

ALTER TABLE public.cards_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous select cards cache" ON public.cards_cache;
CREATE POLICY "Allow anonymous select cards cache" ON public.cards_cache
    FOR SELECT TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous insert cards cache" ON public.cards_cache;
CREATE POLICY "Allow anonymous insert cards cache" ON public.cards_cache
    FOR INSERT TO anon
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update cards cache" ON public.cards_cache;
CREATE POLICY "Allow anonymous update cards cache" ON public.cards_cache
    FOR UPDATE TO anon
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

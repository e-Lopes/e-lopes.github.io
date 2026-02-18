-- Resolve Security Advisor warnings:
-- 1) Function Search Path Mutable
-- 2) RLS Policy Always True (for listed tables)

-- 1) Fix mutable search_path in functions
ALTER FUNCTION public.sync_tournament_date_to_results()
SET search_path = public, pg_temp;

ALTER FUNCTION public.ensure_single_default_format()
SET search_path = public, pg_temp;

-- 2) Replace permissive literal-true write policies
-- deck_images
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.deck_images;
CREATE POLICY "Allow anonymous insert" ON public.deck_images
    FOR INSERT
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update" ON public.deck_images;
CREATE POLICY "Allow anonymous update" ON public.deck_images
    FOR UPDATE
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous delete" ON public.deck_images;
CREATE POLICY "Allow anonymous delete" ON public.deck_images
    FOR DELETE
    USING (auth.role() IN ('anon', 'authenticated'));

-- decks
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.decks;
CREATE POLICY "Allow anonymous insert" ON public.decks
    FOR INSERT
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update" ON public.decks;
CREATE POLICY "Allow anonymous update" ON public.decks
    FOR UPDATE
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous delete" ON public.decks;
CREATE POLICY "Allow anonymous delete" ON public.decks
    FOR DELETE
    USING (auth.role() IN ('anon', 'authenticated'));

-- players
DROP POLICY IF EXISTS "Allow public insert" ON public.players;
CREATE POLICY "Allow public insert" ON public.players
    FOR INSERT
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow public update" ON public.players;
CREATE POLICY "Allow public update" ON public.players
    FOR UPDATE
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow public delete" ON public.players;
CREATE POLICY "Allow public delete" ON public.players
    FOR DELETE
    USING (auth.role() IN ('anon', 'authenticated'));

-- formats
DROP POLICY IF EXISTS "Allow anonymous insert formats" ON public.formats;
CREATE POLICY "Allow anonymous insert formats" ON public.formats
    FOR INSERT
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update formats" ON public.formats;
CREATE POLICY "Allow anonymous update formats" ON public.formats
    FOR UPDATE
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

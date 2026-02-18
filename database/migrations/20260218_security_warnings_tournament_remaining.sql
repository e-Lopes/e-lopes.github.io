-- Resolve remaining Security Advisor warnings (RLS Policy Always True)
-- Target: public.tournament and public.tournament_results

-- tournament (2 warnings)
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.tournament;
CREATE POLICY "Allow anonymous insert" ON public.tournament
    FOR INSERT
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update" ON public.tournament;
CREATE POLICY "Allow anonymous update" ON public.tournament
    FOR UPDATE
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- tournament_results (4 warnings)
DROP POLICY IF EXISTS "Allow anonymous delete" ON public.tournament_results;
CREATE POLICY "Allow anonymous delete" ON public.tournament_results
    FOR DELETE TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous insert" ON public.tournament_results;
CREATE POLICY "Allow anonymous insert" ON public.tournament_results
    FOR INSERT TO anon
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update" ON public.tournament_results;
CREATE POLICY "Allow anonymous update" ON public.tournament_results
    FOR UPDATE TO anon
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public insert tournament results" ON public.tournament_results;
CREATE POLICY "Public insert tournament results" ON public.tournament_results
    FOR INSERT
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

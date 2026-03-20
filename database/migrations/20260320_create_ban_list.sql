-- Migration: 2026-03-20
-- Create ban_list table to manage card restrictions (banned, limited, choice-restricted)
-- Restrictions are enforced at the decklist builder level (not retroactively on existing decklists)

CREATE TABLE IF NOT EXISTS public.ban_list (
    card_code TEXT NOT NULL,
    restriction TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT ban_list_pkey PRIMARY KEY (card_code),
    CONSTRAINT ban_list_restriction_check CHECK (restriction IN ('banned', 'limited', 'choice-restricted'))
);

ALTER TABLE public.ban_list ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE TRIGGER trg_ban_list_updated_at
    BEFORE UPDATE ON public.ban_list
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Allow anonymous select ban_list" ON public.ban_list
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert ban_list" ON public.ban_list
    FOR INSERT WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

CREATE POLICY "Allow anonymous update ban_list" ON public.ban_list
    FOR UPDATE USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]))
    WITH CHECK (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

CREATE POLICY "Allow anonymous delete ban_list" ON public.ban_list
    FOR DELETE USING (auth.role() = ANY (ARRAY['anon'::text, 'authenticated'::text]));

GRANT ALL ON TABLE public.ban_list TO anon;
GRANT ALL ON TABLE public.ban_list TO authenticated;
GRANT ALL ON TABLE public.ban_list TO service_role;

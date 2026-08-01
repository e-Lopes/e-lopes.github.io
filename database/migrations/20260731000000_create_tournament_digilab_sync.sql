-- Tracks the verified relationship between a local tournament and DigiLab.
-- Writes are restricted to the service role used by the integration Edge Function.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tournament_digilab_sync (
    tournament_id bigint PRIMARY KEY
        REFERENCES public.tournament(id) ON DELETE CASCADE,
    digilab_tournament_id bigint UNIQUE,
    digilab_url text,
    status text NOT NULL
        CHECK (status IN ('matched', 'not_found', 'ambiguous', 'mismatch', 'api_error')),
    verified_at timestamptz,
    last_checked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    last_error_code text
        CHECK (last_error_code IS NULL OR char_length(last_error_code) <= 100),
    comparison_summary jsonb,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT tournament_digilab_sync_external_id_positive
        CHECK (digilab_tournament_id IS NULL OR digilab_tournament_id > 0),
    CONSTRAINT tournament_digilab_sync_url_not_blank
        CHECK (digilab_url IS NULL OR btrim(digilab_url) <> ''),
    CONSTRAINT tournament_digilab_sync_summary_is_object
        CHECK (comparison_summary IS NULL OR jsonb_typeof(comparison_summary) = 'object'),
    CONSTRAINT tournament_digilab_sync_match_fields_consistent
        CHECK (
            (
                status = 'matched'
                AND digilab_tournament_id IS NOT NULL
                AND digilab_url IS NOT NULL
                AND verified_at IS NOT NULL
            )
            OR
            (
                status <> 'matched'
                AND digilab_tournament_id IS NULL
                AND digilab_url IS NULL
                AND verified_at IS NULL
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_tournament_digilab_sync_status_checked
    ON public.tournament_digilab_sync (status, last_checked_at DESC);

DROP TRIGGER IF EXISTS trg_tournament_digilab_sync_updated_at
    ON public.tournament_digilab_sync;
CREATE TRIGGER trg_tournament_digilab_sync_updated_at
    BEFORE UPDATE ON public.tournament_digilab_sync
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tournament_digilab_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read DigiLab tournament sync" ON public.tournament_digilab_sync;
CREATE POLICY "Public read DigiLab tournament sync"
    ON public.tournament_digilab_sync FOR SELECT
    TO anon, authenticated
    USING (true);

-- Public clients may read only the fields required to render integration status.
-- Full rows and every write operation remain exclusive to service_role.
REVOKE ALL ON public.tournament_digilab_sync FROM anon, authenticated;
GRANT SELECT (
    tournament_id,
    digilab_tournament_id,
    digilab_url,
    status,
    verified_at,
    last_checked_at
) ON public.tournament_digilab_sync TO anon, authenticated;
GRANT ALL ON public.tournament_digilab_sync TO service_role;

COMMIT;

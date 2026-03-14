BEGIN;

CREATE TABLE IF NOT EXISTS public.decklist_card_metadata (
    card_code text PRIMARY KEY,
    card_type text,
    card_level smallint,
    is_digi_egg boolean NOT NULL DEFAULT false,
    is_staple boolean,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.decklist_card_metadata (card_code, card_type, card_level, is_digi_egg, is_staple)
SELECT
    dc.card_code,
    MAX(dc.card_type) FILTER (WHERE dc.card_type IS NOT NULL) AS card_type,
    MAX(dc.card_level) AS card_level,
    BOOL_OR(dc.is_digi_egg) AS is_digi_egg,
    BOOL_OR(dc.is_staple) AS is_staple
FROM public.decklist_cards dc
GROUP BY dc.card_code
ON CONFLICT (card_code) DO UPDATE SET
    card_type = COALESCE(EXCLUDED.card_type, decklist_card_metadata.card_type),
    card_level = COALESCE(EXCLUDED.card_level, decklist_card_metadata.card_level),
    is_digi_egg = decklist_card_metadata.is_digi_egg OR EXCLUDED.is_digi_egg,
    is_staple = COALESCE(EXCLUDED.is_staple, decklist_card_metadata.is_staple);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'fk_decklist_cards_card_code_metadata'
           AND conrelid = 'public.decklist_cards'::regclass
    ) THEN
        ALTER TABLE public.decklist_cards
            ADD CONSTRAINT fk_decklist_cards_card_code_metadata
            FOREIGN KEY (card_code)
            REFERENCES public.decklist_card_metadata(card_code)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END $$;

DROP VIEW IF EXISTS public.v_decklist_cards_enriched;
DROP VIEW IF EXISTS public.v_top_cards_by_month;

ALTER TABLE public.decklist_cards DROP COLUMN IF EXISTS card_type;
ALTER TABLE public.decklist_cards DROP COLUMN IF EXISTS card_level;
ALTER TABLE public.decklist_cards DROP COLUMN IF EXISTS is_digi_egg;
ALTER TABLE public.decklist_cards DROP COLUMN IF EXISTS is_staple;

DROP TRIGGER IF EXISTS trg_touch_decklist_card_metadata_updated_at ON public.decklist_card_metadata;
CREATE TRIGGER trg_touch_decklist_card_metadata_updated_at
BEFORE UPDATE ON public.decklist_card_metadata
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.decklist_card_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous select decklist card metadata" ON public.decklist_card_metadata;
CREATE POLICY "Allow anonymous select decklist card metadata" ON public.decklist_card_metadata
    FOR SELECT TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous insert decklist card metadata" ON public.decklist_card_metadata;
CREATE POLICY "Allow anonymous insert decklist card metadata" ON public.decklist_card_metadata
    FOR INSERT TO anon
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous update decklist card metadata" ON public.decklist_card_metadata;
CREATE POLICY "Allow anonymous update decklist card metadata" ON public.decklist_card_metadata
    FOR UPDATE TO anon
    USING (auth.role() IN ('anon', 'authenticated'))
    WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow anonymous delete decklist card metadata" ON public.decklist_card_metadata;
CREATE POLICY "Allow anonymous delete decklist card metadata" ON public.decklist_card_metadata
    FOR DELETE TO anon
    USING (auth.role() IN ('anon', 'authenticated'));

CREATE VIEW public.v_top_cards_by_month AS
WITH base AS (
    SELECT
        date_trunc('month'::text, tr.tournament_date::timestamp with time zone) AS month,
        tr.placement,
        dl.id AS decklist_id,
        dc.card_code,
        dc.qty,
        meta.card_type,
        meta.card_level,
        meta.is_digi_egg,
        meta.is_staple
    FROM tournament_results tr
    JOIN decklists dl ON dl.tournament_result_id = tr.id
    JOIN decklist_cards dc ON dc.decklist_id = dl.id
    LEFT JOIN public.decklist_card_metadata meta ON meta.card_code = dc.card_code
    WHERE tr.placement <= 4
),
agg AS (
    SELECT
        b.month,
        b.card_code,
        MAX(b.card_type) FILTER (WHERE b.card_type IS NOT NULL) AS card_type,
        MAX(b.card_level) AS card_level,
        BOOL_OR(b.is_digi_egg) AS is_digi_egg,
        BOOL_OR(b.is_staple) AS is_staple,
        COUNT(DISTINCT b.decklist_id) AS decklists_with_card,
        SUM(b.qty) AS total_copies,
        SUM(CASE WHEN b.placement = 1 THEN b.qty ELSE 0 END) AS champion_copies,
        SUM(CASE WHEN b.placement <= 2 THEN b.qty ELSE 0 END) AS top2_copies,
        SUM(CASE WHEN b.placement <= 3 THEN b.qty ELSE 0 END) AS top3_copies,
        SUM(CASE WHEN b.placement <= 4 THEN b.qty ELSE 0 END) AS top4_copies
    FROM base b
    GROUP BY b.month, b.card_code
)
SELECT
    month,
    card_code,
    card_type,
    card_level,
    is_digi_egg,
    is_staple,
    decklists_with_card,
    total_copies,
    champion_copies,
    top2_copies,
    top3_copies,
    top4_copies,
    DENSE_RANK() OVER (
        PARTITION BY month
        ORDER BY total_copies DESC, decklists_with_card DESC, card_code
    ) AS monthly_rank
FROM agg a
ORDER BY
    month DESC,
    (
        DENSE_RANK() OVER (
            PARTITION BY month
            ORDER BY total_copies DESC, decklists_with_card DESC, card_code
        )
    ),
    card_code;

ALTER VIEW public.v_top_cards_by_month SET (security_invoker = true);

GRANT ALL ON TABLE public.v_top_cards_by_month TO anon;
GRANT ALL ON TABLE public.v_top_cards_by_month TO authenticated;
GRANT ALL ON TABLE public.v_top_cards_by_month TO service_role;

CREATE VIEW public.v_decklist_cards_enriched AS
WITH dc_norm AS (
    SELECT
        dc_1.id,
        dc_1.decklist_id,
        dc_1.position,
        dc_1.card_code,
        dc_1.qty,
        dc_1.created_at,
        dc_1.updated_at,
        UPPER(
            (
                split_part(
                    regexp_replace(
                        dc_1.card_code,
                        '_[A-Z0-9]+$'::text,
                        ''::text,
                        'i'::text
                    ),
                    '-'::text,
                    1
                ) || '-'::text
            ) || COALESCE(
                NULLIF(
                    ltrim(
                        split_part(
                            regexp_replace(
                                dc_1.card_code,
                                '_[A-Z0-9]+$'::text,
                                ''::text,
                                'i'::text
                            ),
                            '-'::text,
                            2
                        ),
                        '0'::text
                    ),
                    ''::text
                ),
                '0'::text
            )
        ) AS norm_code
    FROM decklist_cards dc_1
),
cc_norm AS (
    SELECT
        cc_1.card_code,
        cc_1.id,
        cc_1.name,
        cc_1.pack,
        cc_1.color,
        cc_1.type,
        cc_1.card_payload,
        cc_1.created_at,
        cc_1.updated_at,
        UPPER(
            (
                split_part(
                    regexp_replace(
                        cc_1.card_code,
                        '_[A-Z0-9]+$'::text,
                        ''::text,
                        'i'::text
                    ),
                    '-'::text,
                    1
                ) || '-'::text
            ) || COALESCE(
                NULLIF(
                    ltrim(
                        split_part(
                            regexp_replace(
                                cc_1.card_code,
                                '_[A-Z0-9]+$'::text,
                                ''::text,
                                'i'::text
                            ),
                            '-'::text,
                            2
                        ),
                        '0'::text
                    ),
                    ''::text
                ),
                '0'::text
            )
        ) AS norm_code
    FROM cards_cache cc_1
)
SELECT
    dc.id,
    dc.decklist_id,
    dc.position,
    dc.card_code,
    dc.qty,
    COALESCE(NULLIF(meta.card_type, ''::text), cc.type) AS card_type,
    COALESCE(
        meta.card_level,
        CASE
            WHEN (cc.card_payload ->> 'level'::text) ~ '^\\d+$'::text THEN (cc.card_payload ->> 'level'::text)::integer
            ELSE NULL::integer
        END
    ) AS card_level,
    COALESCE(
        meta.is_digi_egg,
        LOWER(
            COALESCE(
                NULLIF(cc.type, ''::text),
                cc.card_payload ->> 'type'::text,
                ''::text
            )
        ) = ANY (ARRAY['digi-egg'::text, 'digitama'::text])
    ) AS is_digi_egg,
    cc.name,
    cc.pack,
    cc.color,
    cc.card_payload
FROM dc_norm dc
LEFT JOIN public.decklist_card_metadata meta ON meta.card_code = dc.card_code
LEFT JOIN cc_norm cc ON cc.norm_code = dc.norm_code;

ALTER VIEW public.v_decklist_cards_enriched SET (security_invoker = true);

GRANT ALL ON TABLE public.v_decklist_cards_enriched TO anon;
GRANT ALL ON TABLE public.v_decklist_cards_enriched TO authenticated;
GRANT ALL ON TABLE public.v_decklist_cards_enriched TO service_role;

COMMIT;

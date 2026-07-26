-- Save a tournament, its results and OCR metadata as one database transaction.

BEGIN;

-- Placement/player swaps during an edit must only be validated at transaction end.
ALTER TABLE public.tournament_results
    DROP CONSTRAINT IF EXISTS unique_player_per_tournament;

ALTER TABLE public.tournament_results
    ADD CONSTRAINT unique_player_per_tournament
    UNIQUE (store_id, tournament_date, player_id)
    DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE public.tournament_results
    DROP CONSTRAINT IF EXISTS unique_tournament_placement;

ALTER TABLE public.tournament_results
    ADD CONSTRAINT unique_tournament_placement
    UNIQUE (store_id, tournament_date, placement)
    DEFERRABLE INITIALLY IMMEDIATE;

CREATE OR REPLACE FUNCTION public.save_tournament_transaction(
    p_tournament_id bigint,
    p_tournament jsonb,
    p_results jsonb,
    p_ocr_files jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_tournament_id bigint;
    v_store_id uuid;
    v_tournament_date date;
    v_tournament_name text;
    v_total_players smallint;
    v_instagram_link text;
    v_format_id bigint;
    v_result jsonb;
    v_ordinality bigint;
    v_result_id uuid;
    v_existing_ids uuid[] := ARRAY[]::uuid[];
    v_rows_affected integer;
BEGIN
    IF p_tournament IS NULL OR jsonb_typeof(p_tournament) <> 'object' THEN
        RAISE EXCEPTION 'Dados do torneio invalidos.' USING ERRCODE = '22023';
    END IF;
    IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
        RAISE EXCEPTION 'Resultados invalidos.' USING ERRCODE = '22023';
    END IF;
    IF p_ocr_files IS NULL OR jsonb_typeof(p_ocr_files) <> 'array' THEN
        RAISE EXCEPTION 'Metadados dos prints invalidos.' USING ERRCODE = '22023';
    END IF;

    v_store_id := NULLIF(p_tournament->>'store_id', '')::uuid;
    v_tournament_date := NULLIF(p_tournament->>'tournament_date', '')::date;
    v_tournament_name := btrim(COALESCE(p_tournament->>'tournament_name', ''));
    v_total_players := NULLIF(p_tournament->>'total_players', '')::smallint;
    v_instagram_link := NULLIF(btrim(COALESCE(p_tournament->>'instagram_link', '')), '');
    v_format_id := NULLIF(p_tournament->>'format_id', '')::bigint;

    IF v_format_id IS NULL THEN
        SELECT id INTO v_format_id
        FROM public.formats
        WHERE is_default = true
        ORDER BY id
        LIMIT 1;
    END IF;

    IF v_store_id IS NULL OR v_tournament_date IS NULL OR v_tournament_name = '' OR
       v_total_players IS NULL OR v_total_players < 1 OR v_total_players > 36 OR
       v_format_id IS NULL THEN
        RAISE EXCEPTION 'Campos obrigatorios do torneio invalidos.' USING ERRCODE = '22023';
    END IF;
    IF jsonb_array_length(p_results) <> v_total_players THEN
        RAISE EXCEPTION 'O total de players deve corresponder aos resultados.' USING ERRCODE = '22023';
    END IF;

    SET CONSTRAINTS unique_player_per_tournament, unique_tournament_placement DEFERRED;

    IF p_tournament_id IS NULL THEN
        INSERT INTO public.tournament (
            store_id, tournament_date, tournament_name, total_players, instagram_link, format_id
        ) VALUES (
            v_store_id, v_tournament_date, v_tournament_name, v_total_players,
            v_instagram_link, v_format_id
        )
        RETURNING id INTO v_tournament_id;
    ELSE
        UPDATE public.tournament
        SET store_id = v_store_id,
            tournament_date = v_tournament_date,
            tournament_name = v_tournament_name,
            total_players = v_total_players,
            instagram_link = v_instagram_link,
            format_id = v_format_id
        WHERE id = p_tournament_id
        RETURNING id INTO v_tournament_id;

        IF v_tournament_id IS NULL THEN
            RAISE EXCEPTION 'Torneio nao encontrado.' USING ERRCODE = 'P0002';
        END IF;

        SELECT COALESCE(array_agg((item->>'id')::uuid), ARRAY[]::uuid[])
        INTO v_existing_ids
        FROM jsonb_array_elements(p_results) AS source(item)
        WHERE NULLIF(item->>'id', '') IS NOT NULL;

        DELETE FROM public.tournament_results
        WHERE tournament_id = v_tournament_id
          AND NOT (id = ANY(v_existing_ids));
    END IF;

    FOR v_result, v_ordinality IN
        SELECT item, ordinality
        FROM jsonb_array_elements(p_results) WITH ORDINALITY AS source(item, ordinality)
    LOOP
        IF NULLIF(v_result->>'player_id', '') IS NULL THEN
            RAISE EXCEPTION 'Player ausente na colocacao %.', v_ordinality USING ERRCODE = '22023';
        END IF;
        IF NULLIF(v_result->>'match_points', '')::integer < 0 THEN
            RAISE EXCEPTION 'Pontos invalidos na colocacao %.', v_ordinality USING ERRCODE = '22023';
        END IF;

        v_result_id := NULLIF(v_result->>'id', '')::uuid;

        IF p_tournament_id IS NOT NULL AND v_result_id IS NOT NULL THEN
            UPDATE public.tournament_results
            SET store_id = v_store_id,
                tournament_date = v_tournament_date,
                total_players = v_total_players,
                placement = v_ordinality::smallint,
                deck_id = NULLIF(v_result->>'deck_id', '')::uuid,
                player_id = (v_result->>'player_id')::uuid,
                match_points = NULLIF(v_result->>'match_points', '')::integer
            WHERE id = v_result_id
              AND tournament_id = v_tournament_id;

            GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
            IF v_rows_affected <> 1 THEN
                RAISE EXCEPTION 'Resultado % nao pertence ao torneio.', v_result_id USING ERRCODE = '22023';
            END IF;
        ELSE
            v_result_id := NULL;

            -- Older imports may have left an unlinked row for the same event/place.
            IF p_tournament_id IS NULL THEN
                SELECT id INTO v_result_id
                FROM public.tournament_results
                WHERE tournament_id IS NULL
                  AND store_id = v_store_id
                  AND tournament_date = v_tournament_date
                  AND placement = v_ordinality::smallint
                FOR UPDATE
                LIMIT 1;
            END IF;

            IF v_result_id IS NOT NULL THEN
                UPDATE public.tournament_results
                SET tournament_id = v_tournament_id,
                    total_players = v_total_players,
                    deck_id = NULLIF(v_result->>'deck_id', '')::uuid,
                    player_id = (v_result->>'player_id')::uuid,
                    match_points = NULLIF(v_result->>'match_points', '')::integer
                WHERE id = v_result_id;
            ELSE
                INSERT INTO public.tournament_results (
                    tournament_id, store_id, tournament_date, total_players, placement,
                    deck_id, player_id, match_points
                ) VALUES (
                    v_tournament_id, v_store_id, v_tournament_date, v_total_players,
                    v_ordinality::smallint, NULLIF(v_result->>'deck_id', '')::uuid,
                    (v_result->>'player_id')::uuid,
                    NULLIF(v_result->>'match_points', '')::integer
                );
            END IF;
        END IF;
    END LOOP;

    INSERT INTO public.tournament_ocr_files (
        tournament_id, batch_id, storage_path, original_name, mime_type, size_bytes
    )
    SELECT
        v_tournament_id,
        (item->>'batch_id')::uuid,
        item->>'storage_path',
        item->>'original_name',
        NULLIF(item->>'mime_type', ''),
        NULLIF(item->>'size_bytes', '')::bigint
    FROM jsonb_array_elements(p_ocr_files) AS source(item);

    RETURN jsonb_build_object(
        'tournament_id', v_tournament_id,
        'results_count', jsonb_array_length(p_results),
        'ocr_files_count', jsonb_array_length(p_ocr_files)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_tournament_transaction(bigint, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_tournament_transaction(bigint, jsonb, jsonb, jsonb)
    TO anon, authenticated;

COMMIT;

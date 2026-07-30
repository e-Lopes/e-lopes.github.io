-- Delete a tournament and its dependent database records atomically.
-- Storage objects are removed by the client from the paths returned here.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_tournament_transaction(p_tournament_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_store_id uuid;
    v_tournament_date date;
    v_storage_paths jsonb;
BEGIN
    SELECT store_id, tournament_date
    INTO v_store_id, v_tournament_date
    FROM public.tournament
    WHERE id = p_tournament_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament % not found', p_tournament_id
            USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(jsonb_agg(storage_path ORDER BY id), '[]'::jsonb)
    INTO v_storage_paths
    FROM public.tournament_ocr_files
    WHERE tournament_id = p_tournament_id;

    DELETE FROM public.tournament_results
    WHERE tournament_id = p_tournament_id
       OR (
            tournament_id IS NULL
            AND store_id = v_store_id
            AND tournament_date = v_tournament_date
       );

    DELETE FROM public.tournament
    WHERE id = p_tournament_id;

    RETURN jsonb_build_object(
        'tournament_id', p_tournament_id,
        'storage_paths', v_storage_paths
    );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_tournament_transaction(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tournament_transaction(bigint) TO anon, authenticated;

COMMIT;

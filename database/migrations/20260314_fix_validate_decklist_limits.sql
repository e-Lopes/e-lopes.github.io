CREATE OR REPLACE FUNCTION public.validate_decklist_limits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_decklist_id bigint;
    v_egg integer;
    v_main integer;
BEGIN
    v_decklist_id := coalesce(NEW.decklist_id, OLD.decklist_id);

    SELECT
        coalesce(sum(CASE WHEN meta.is_digi_egg THEN dc.qty ELSE 0 END), 0),
        coalesce(sum(CASE WHEN NOT meta.is_digi_egg THEN dc.qty ELSE 0 END), 0)
    INTO v_egg, v_main
    FROM public.decklist_cards dc
    JOIN public.decklist_card_metadata meta ON meta.card_code = dc.card_code
    WHERE dc.decklist_id = v_decklist_id;

    IF v_egg > 5 THEN
        RAISE EXCEPTION 'Decklist inválida: Digi-Egg > 5 (atual: %)', v_egg;
    END IF;

    IF v_main > 50 THEN
        RAISE EXCEPTION 'Decklist inválida: Main deck > 50 (atual: %)', v_main;
    END IF;

    IF (v_egg + v_main) > 55 THEN
        RAISE EXCEPTION 'Decklist inválida: Total > 55 (atual: %)', (v_egg + v_main);
    END IF;

    RETURN NULL;
END;
$$;

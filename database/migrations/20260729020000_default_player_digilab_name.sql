-- Existing players without a Digilab name inherit their registered name.
UPDATE public.players
SET digilab_name = name
WHERE digilab_name IS NULL OR btrim(digilab_name) = '';

-- PostgreSQL column defaults cannot reference another column from the same row,
-- so a trigger keeps the fallback consistent for every database client.
CREATE OR REPLACE FUNCTION public.set_player_digilab_name_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.digilab_name IS NULL OR pg_catalog.btrim(NEW.digilab_name) = '' THEN
        NEW.digilab_name := NEW.name;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_players_default_digilab_name ON public.players;

CREATE TRIGGER trg_players_default_digilab_name
BEFORE INSERT OR UPDATE OF name, digilab_name
ON public.players
FOR EACH ROW
EXECUTE FUNCTION public.set_player_digilab_name_default();

ALTER TABLE public.players
    ALTER COLUMN digilab_name SET NOT NULL;

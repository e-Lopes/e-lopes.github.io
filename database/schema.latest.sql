


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."ensure_single_default_format"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE public.formats
        SET is_default = false
        WHERE id <> COALESCE(NEW.id, -1)
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_format"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_player_bandai"("p_bandai_id" "text", "p_bandai_nick" "text") RETURNS TABLE("id" "uuid", "name" "text", "bandai_id" "text", "bandai_nick" "text", "match_type" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- 1. Tenta pelo bandai_id (mais confiável, exceto GUEST)
  IF p_bandai_id IS NOT NULL AND p_bandai_id NOT ILIKE 'GUEST%' THEN
    RETURN QUERY
      SELECT p.id, p.name, p.bandai_id, p.bandai_nick, 'bandai_id'::TEXT
      FROM players p
      WHERE p.bandai_id = p_bandai_id
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 2. Tenta pelo bandai_nick (case-insensitive)
  IF p_bandai_nick IS NOT NULL AND p_bandai_nick <> '' THEN
    RETURN QUERY
      SELECT p.id, p.name, p.bandai_id, p.bandai_nick, 'bandai_nick'::TEXT
      FROM players p
      WHERE LOWER(p.bandai_nick) = LOWER(p_bandai_nick)
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 3. Fallback: tenta pelo name da tabela (case-insensitive)
  IF p_bandai_nick IS NOT NULL AND p_bandai_nick <> '' THEN
    RETURN QUERY
      SELECT p.id, p.name, p.bandai_id, p.bandai_nick, 'name_fallback'::TEXT
      FROM players p
      WHERE LOWER(p.name) = LOWER(p_bandai_nick)
      LIMIT 1;
  END IF;
END;
$$;


ALTER FUNCTION "public"."match_player_bandai"("p_bandai_id" "text", "p_bandai_nick" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_temp', 'public'
    AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_tournament_date_to_results"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
    -- Verifica se a data realmente mudou para não pesar o banco à toa
    IF (OLD.tournament_date IS DISTINCT FROM NEW.tournament_date) THEN
        UPDATE tournament_results
        SET tournament_date = NEW.tournament_date
        WHERE tournament_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_tournament_date_to_results"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  -- update "updated_at" timestamp
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_decklist_limits"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."validate_decklist_limits"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cards_cache" (
    "card_code" "text" NOT NULL,
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "pack" "text",
    "color" "text",
    "type" "text",
    "card_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."cards_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deck_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deck_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."deck_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."decklist_card_metadata" (
    "card_code" "text" NOT NULL,
    "card_type" "text",
    "card_level" smallint,
    "is_digi_egg" boolean DEFAULT false NOT NULL,
    "is_staple" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."decklist_card_metadata" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."decklist_cards" (
    "id" bigint NOT NULL,
    "decklist_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "card_code" "text" NOT NULL,
    "qty" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "decklist_cards_position_check" CHECK (("position" > 0)),
    CONSTRAINT "decklist_cards_qty_check" CHECK ((("qty" >= 1) AND ("qty" <= 50)))
);


ALTER TABLE "public"."decklist_cards" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."decklist_cards_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."decklist_cards_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."decklist_cards_id_seq" OWNED BY "public"."decklist_cards"."id";



CREATE TABLE IF NOT EXISTS "public"."decklists" (
    "id" bigint NOT NULL,
    "tournament_result_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."decklists" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."decklists_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."decklists_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."decklists_id_seq" OWNED BY "public"."decklists"."id";



CREATE TABLE IF NOT EXISTS "public"."decks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "colors" "text"
);


ALTER TABLE "public"."decks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."formats" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "name" "text",
    "background_path" "text",
    "background_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."formats" OWNER TO "postgres";


ALTER TABLE "public"."formats" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."formats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bandai_id" "text",
    "bandai_nick" "text"
);


ALTER TABLE "public"."players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "bandai_nick" "text"
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tournament_name" "text",
    "tournament_date" "date",
    "store_id" "uuid",
    "total_players" smallint,
    "instagram_link" "text",
    "format_id" bigint NOT NULL,
    "rounds" smallint
);


ALTER TABLE "public"."tournament" OWNER TO "postgres";


ALTER TABLE "public"."tournament" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tournament_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournament_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "tournament_date" "date" NOT NULL,
    "total_players" smallint NOT NULL,
    "placement" smallint NOT NULL,
    "deck_id" "uuid",
    "decklist" "text",
    "player_id" "uuid",
    "tournament_id" bigint,
    CONSTRAINT "placement_valid" CHECK (("placement" <= "total_players")),
    CONSTRAINT "tournament_results_placement_check" CHECK (("placement" > 0)),
    CONSTRAINT "tournament_results_total_players_check" CHECK (("total_players" > 0))
);


ALTER TABLE "public"."tournament_results" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_deck_rank" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "date_trunc"('month'::"text", ("tr"."tournament_date")::timestamp with time zone) AS "month",
            "tr"."tournament_id",
            "tr"."store_id",
            "tr"."tournament_date",
            "tr"."player_id",
            "tr"."placement",
            "tr"."total_players",
            COALESCE(("t"."rounds")::integer,
                CASE
                    WHEN ("tr"."total_players" <= 8) THEN 3
                    ELSE 4
                END) AS "rounds",
            "d"."name" AS "deck_name"
           FROM (("public"."tournament_results" "tr"
             JOIN "public"."decks" "d" ON (("d"."id" = "tr"."deck_id")))
             LEFT JOIN "public"."tournament" "t" ON (("t"."id" = "tr"."tournament_id")))
        ), "scored" AS (
         SELECT "b"."month",
            "b"."tournament_id",
            "b"."store_id",
            "b"."tournament_date",
            "b"."player_id",
            "b"."placement",
            "b"."total_players",
            "b"."rounds",
            "b"."deck_name",
                CASE
                    WHEN ("b"."placement" = 1) THEN 4
                    WHEN ("b"."placement" = 2) THEN 3
                    WHEN ("b"."placement" = 3) THEN 2
                    WHEN ("b"."placement" = 4) THEN 1
                    ELSE 0
                END AS "placement_points",
                CASE
                    WHEN (COALESCE(("b"."total_players")::integer, 0) <= 8) THEN 1.0
                    WHEN (("b"."total_players" >= 9) AND ("b"."total_players" <= 16)) THEN 1.2
                    WHEN (("b"."total_players" >= 17) AND (COALESCE("b"."rounds", 0) >= 5)) THEN 1.5
                    WHEN ("b"."total_players" >= 17) THEN 1.0
                    ELSE 1.0
                END AS "points_multiplier",
                CASE
                    WHEN (COALESCE(("b"."total_players")::integer, 0) <= 8) THEN 100
                    WHEN (("b"."total_players" >= 9) AND ("b"."total_players" <= 16)) THEN 120
                    WHEN (("b"."total_players" >= 17) AND (COALESCE("b"."rounds", 0) >= 5)) THEN 150
                    WHEN ("b"."total_players" >= 17) THEN 100
                    ELSE 100
                END AS "points_weight_percent"
           FROM "base" "b"
        )
 SELECT "month",
    "deck_name" AS "deck",
    "count"(*) AS "monthly_appearances",
    "count"(DISTINCT COALESCE(("tournament_id")::"text", "concat_ws"('|'::"text", ("store_id")::"text", ("tournament_date")::"text"))) AS "tournament_appearances",
    "count"(DISTINCT "player_id") AS "unique_players",
    "sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END) AS "titles",
    "sum"(
        CASE
            WHEN ("placement" <= 4) THEN 1
            ELSE 0
        END) AS "top4_total",
    ("round"("avg"(("placement")::numeric), 0))::integer AS "avg_placement",
    "min"("placement") AS "best_finish",
    "max"("placement") AS "worst_finish",
    "sum"("placement_points") AS "base_points",
    "round"("sum"((("placement_points")::numeric * "points_multiplier")), 2) AS "ranking_points",
    "dense_rank"() OVER (PARTITION BY "month" ORDER BY ("sum"((("placement_points")::numeric * "points_multiplier"))) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC) AS "performance_rank"
   FROM "scored" "s"
  GROUP BY "month", "deck_name"
  ORDER BY "month" DESC, ("dense_rank"() OVER (PARTITION BY "month" ORDER BY ("sum"((("placement_points")::numeric * "points_multiplier"))) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC)), "deck_name";


ALTER VIEW "public"."v_deck_rank" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_deck_representation" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "tr"."id",
            "tr"."tournament_id",
            "tr"."tournament_date",
            "tr"."placement",
            "tr"."player_id",
            "d"."name" AS "deck_name"
           FROM ("public"."tournament_results" "tr"
             JOIN "public"."decks" "d" ON (("d"."id" = "tr"."deck_id")))
        )
 SELECT "deck_name" AS "deck",
    "count"(*) AS "appearances",
    "count"(DISTINCT "tournament_id") AS "tournaments_played",
    "count"(DISTINCT "player_id") AS "unique_players",
    "sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END) AS "titles",
    "sum"(
        CASE
            WHEN ("placement" <= 4) THEN 1
            ELSE 0
        END) AS "top4_finishes",
    "round"("avg"(("placement")::numeric), 2) AS "avg_placement",
    "round"(((100.0 * ("count"(*))::numeric) / NULLIF("sum"("count"(*)) OVER (), (0)::numeric)), 2) AS "meta_share_percent"
   FROM "base" "b"
  GROUP BY "deck_name"
  ORDER BY ("round"(((100.0 * ("count"(*))::numeric) / NULLIF("sum"("count"(*)) OVER (), (0)::numeric)), 2)) DESC, ("count"(*)) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC;


ALTER VIEW "public"."v_deck_representation" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_deck_stats" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "tr"."placement",
            "d"."name" AS "deck_name"
           FROM ("public"."tournament_results" "tr"
             JOIN "public"."decks" "d" ON (("d"."id" = "tr"."deck_id")))
        ), "scored" AS (
         SELECT "b"."placement",
            "b"."deck_name",
                CASE
                    WHEN ("b"."placement" = 1) THEN 15
                    WHEN ("b"."placement" = 2) THEN 10
                    WHEN ("b"."placement" = 3) THEN 7
                    WHEN ("b"."placement" = 4) THEN 5
                    ELSE 0
                END AS "placement_points"
           FROM "base" "b"
        )
 SELECT "deck_name" AS "deck",
    "sum"(
        CASE
            WHEN ("placement" <= 4) THEN 1
            ELSE 0
        END) AS "top4_total",
    "sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END) AS "titles",
    "count"(*) AS "entries",
    "round"("avg"(("placement")::numeric), 2) AS "avg_placement",
    "min"("placement") AS "best_finish",
    "max"("placement") AS "worst_finish",
    "sum"("placement_points") AS "ranking_points",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 2) AS "title_rate_percent",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("placement" <= 4) THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 2) AS "top4_rate_percent",
    "dense_rank"() OVER (ORDER BY ("sum"("placement_points")) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC) AS "performance_rank"
   FROM "scored" "s"
  GROUP BY "deck_name"
  ORDER BY ("dense_rank"() OVER (ORDER BY ("sum"("placement_points")) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC)), "deck_name";


ALTER VIEW "public"."v_deck_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_decklist_cards_enriched" WITH ("security_invoker"='true') AS
 WITH "dc_norm" AS (
         SELECT "dc_1"."id",
            "dc_1"."decklist_id",
            "dc_1"."position",
            "dc_1"."card_code",
            "dc_1"."qty",
            "dc_1"."created_at",
            "dc_1"."updated_at",
            "upper"((("split_part"("regexp_replace"("dc_1"."card_code", '_[A-Z0-9]+$'::"text", ''::"text", 'i'::"text"), '-'::"text", 1) || '-'::"text") || COALESCE(NULLIF("ltrim"("split_part"("regexp_replace"("dc_1"."card_code", '_[A-Z0-9]+$'::"text", ''::"text", 'i'::"text"), '-'::"text", 2), '0'::"text"), ''::"text"), '0'::"text"))) AS "norm_code"
           FROM "public"."decklist_cards" "dc_1"
        ), "cc_norm" AS (
         SELECT "cc_1"."card_code",
            "cc_1"."id",
            "cc_1"."name",
            "cc_1"."pack",
            "cc_1"."color",
            "cc_1"."type",
            "cc_1"."card_payload",
            "cc_1"."created_at",
            "cc_1"."updated_at",
            "upper"((("split_part"("regexp_replace"("cc_1"."card_code", '_[A-Z0-9]+$'::"text", ''::"text", 'i'::"text"), '-'::"text", 1) || '-'::"text") || COALESCE(NULLIF("ltrim"("split_part"("regexp_replace"("cc_1"."card_code", '_[A-Z0-9]+$'::"text", ''::"text", 'i'::"text"), '-'::"text", 2), '0'::"text"), ''::"text"), '0'::"text"))) AS "norm_code"
           FROM "public"."cards_cache" "cc_1"
        )
 SELECT "dc"."id",
    "dc"."decklist_id",
    "dc"."position",
    "dc"."card_code",
    "dc"."qty",
    COALESCE(NULLIF("meta"."card_type", ''::"text"), "cc"."type") AS "card_type",
    COALESCE(("meta"."card_level")::integer,
        CASE
            WHEN (("cc"."card_payload" ->> 'level'::"text") ~ '^\d+$'::"text") THEN (("cc"."card_payload" ->> 'level'::"text"))::integer
            ELSE NULL::integer
        END) AS "card_level",
    COALESCE("meta"."is_digi_egg", ("lower"(COALESCE(NULLIF("cc"."type", ''::"text"), ("cc"."card_payload" ->> 'type'::"text"), ''::"text")) = ANY (ARRAY['digi-egg'::"text", 'digitama'::"text"]))) AS "is_digi_egg",
    "cc"."name",
    "cc"."pack",
    "cc"."color",
    "cc"."card_payload"
   FROM (("dc_norm" "dc"
     LEFT JOIN "public"."decklist_card_metadata" "meta" ON (("meta"."card_code" = "dc"."card_code")))
     LEFT JOIN "cc_norm" "cc" ON (("cc"."norm_code" = "dc"."norm_code")));


ALTER VIEW "public"."v_decklist_cards_enriched" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_meta_by_month" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "date_trunc"('month'::"text", ("tr"."tournament_date")::timestamp with time zone) AS "month",
            COALESCE("f"."code", 'UNSPECIFIED'::"text") AS "format_code",
            "d"."name" AS "deck_name",
            "tr"."placement"
           FROM ((("public"."tournament_results" "tr"
             JOIN "public"."decks" "d" ON (("d"."id" = "tr"."deck_id")))
             LEFT JOIN "public"."tournament" "t" ON (("t"."id" = "tr"."tournament_id")))
             LEFT JOIN "public"."formats" "f" ON (("f"."id" = "t"."format_id")))
        ), "rollup" AS (
         SELECT "b"."month",
            "b"."format_code",
            "b"."deck_name",
            "count"(*) AS "appearances",
            "sum"(
                CASE
                    WHEN ("b"."placement" <= 4) THEN 1
                    ELSE 0
                END) AS "top4_total",
            "sum"(
                CASE
                    WHEN ("b"."placement" = 1) THEN 1
                    ELSE 0
                END) AS "titles"
           FROM "base" "b"
          GROUP BY "b"."month", "b"."format_code", "b"."deck_name"
        )
 SELECT "month",
    "deck_name" AS "deck",
    "appearances",
    "format_code",
    "round"(((100.0 * ("appearances")::numeric) / NULLIF("sum"("appearances") OVER (PARTITION BY "month", "format_code"), (0)::numeric)), 2) AS "meta_share_percent",
    "top4_total",
    "titles"
   FROM "rollup" "r"
  ORDER BY "month" DESC, "format_code", ("round"(((100.0 * ("appearances")::numeric) / NULLIF("sum"("appearances") OVER (PARTITION BY "month", "format_code"), (0)::numeric)), 2)) DESC, "appearances" DESC;


ALTER VIEW "public"."v_meta_by_month" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_monthly_ranking" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "date_trunc"('month'::"text", ("tr"."tournament_date")::timestamp with time zone) AS "month",
            "p"."name" AS "player_name",
            "tr"."placement"
           FROM ("public"."tournament_results" "tr"
             JOIN "public"."players" "p" ON (("p"."id" = "tr"."player_id")))
        ), "scored" AS (
         SELECT "b"."month",
            "b"."player_name",
            "b"."placement",
                CASE
                    WHEN ("b"."placement" = 1) THEN 15
                    WHEN ("b"."placement" = 2) THEN 10
                    WHEN ("b"."placement" = 3) THEN 7
                    WHEN ("b"."placement" = 4) THEN 5
                    ELSE 0
                END AS "placement_points"
           FROM "base" "b"
        )
 SELECT "month",
    "player_name" AS "player",
    "sum"("placement_points") AS "points",
    "count"(*) AS "entries",
    "sum"(
        CASE
            WHEN ("placement" <= 4) THEN 1
            ELSE 0
        END) AS "top4_total",
    "sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END) AS "titles",
    "round"("avg"(("placement")::numeric), 2) AS "avg_placement",
    "dense_rank"() OVER (PARTITION BY "month" ORDER BY ("sum"("placement_points")) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC) AS "monthly_rank"
   FROM "scored" "s"
  GROUP BY "month", "player_name"
  ORDER BY "month" DESC, ("dense_rank"() OVER (PARTITION BY "month" ORDER BY ("sum"("placement_points")) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC)), "player_name";


ALTER VIEW "public"."v_monthly_ranking" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_player_ranking" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "p"."name" AS "player_name",
            "tr"."tournament_date",
            "tr"."deck_id",
            "tr"."placement"
           FROM ("public"."tournament_results" "tr"
             JOIN "public"."players" "p" ON (("p"."id" = "tr"."player_id")))
        ), "scored" AS (
         SELECT "b"."player_name",
            "b"."tournament_date",
            "b"."deck_id",
            "b"."placement",
                CASE
                    WHEN ("b"."placement" = 1) THEN 15
                    WHEN ("b"."placement" = 2) THEN 10
                    WHEN ("b"."placement" = 3) THEN 7
                    WHEN ("b"."placement" = 4) THEN 5
                    ELSE 0
                END AS "placement_points"
           FROM "base" "b"
        )
 SELECT "player_name" AS "player",
    "sum"(
        CASE
            WHEN ("placement" <= 4) THEN 1
            ELSE 0
        END) AS "top4_total",
    "sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END) AS "titles",
    "sum"("placement_points") AS "ranking_points",
    "count"(*) AS "entries",
    "round"("avg"(("placement")::numeric), 2) AS "avg_placement",
    "count"(DISTINCT "deck_id") AS "unique_decks_used",
    "max"("tournament_date") AS "last_event_date",
    "round"(((100.0 * ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END))::numeric) / (NULLIF("count"(*), 0))::numeric), 2) AS "title_rate_percent",
    "dense_rank"() OVER (ORDER BY ("sum"("placement_points")) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC) AS "overall_rank"
   FROM "scored" "s"
  GROUP BY "player_name"
  ORDER BY ("dense_rank"() OVER (ORDER BY ("sum"("placement_points")) DESC, ("sum"(
        CASE
            WHEN ("placement" = 1) THEN 1
            ELSE 0
        END)) DESC, ("count"(*)) DESC)), "player_name";


ALTER VIEW "public"."v_player_ranking" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_podium" WITH ("security_invoker"='true') AS
 SELECT "tr"."id",
    "s"."name" AS "store",
    "tr"."tournament_date",
    "tr"."placement",
    "p"."name" AS "player",
    "d"."name" AS "deck",
    "tr"."tournament_id",
    "t"."tournament_name",
    COALESCE("f"."code", 'UNSPECIFIED'::"text") AS "format_code"
   FROM ((((("public"."tournament_results" "tr"
     JOIN "public"."stores" "s" ON (("s"."id" = "tr"."store_id")))
     JOIN "public"."decks" "d" ON (("d"."id" = "tr"."deck_id")))
     LEFT JOIN "public"."players" "p" ON (("p"."id" = "tr"."player_id")))
     LEFT JOIN "public"."tournament" "t" ON (("t"."id" = "tr"."tournament_id")))
     LEFT JOIN "public"."formats" "f" ON (("f"."id" = "t"."format_id")));


ALTER VIEW "public"."v_podium" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_podium_full" WITH ("security_invoker"='true') AS
 SELECT "tr"."id",
    "tr"."store_id",
    "s"."name" AS "store",
    "tr"."tournament_date",
    "tr"."placement",
    "p"."name" AS "player",
    "d"."name" AS "deck",
    "di"."image_url",
    "tr"."total_players",
    "tr"."tournament_id",
    "tr"."decklist",
    "t"."tournament_name",
    "t"."instagram_link",
    COALESCE("f"."code", 'UNSPECIFIED'::"text") AS "format_code"
   FROM (((((("public"."tournament_results" "tr"
     JOIN "public"."stores" "s" ON (("s"."id" = "tr"."store_id")))
     JOIN "public"."decks" "d" ON (("d"."id" = "tr"."deck_id")))
     LEFT JOIN "public"."players" "p" ON (("p"."id" = "tr"."player_id")))
     LEFT JOIN "public"."tournament" "t" ON (("t"."id" = "tr"."tournament_id")))
     LEFT JOIN "public"."formats" "f" ON (("f"."id" = "t"."format_id")))
     LEFT JOIN LATERAL ( SELECT "dimg"."image_url"
           FROM "public"."deck_images" "dimg"
          WHERE ("dimg"."deck_id" = "d"."id")
          ORDER BY "dimg"."created_at" DESC, "dimg"."id" DESC
         LIMIT 1) "di" ON (true));


ALTER VIEW "public"."v_podium_full" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_stats_base" WITH ("security_invoker"='true') AS
 SELECT "tr"."id",
    "tr"."tournament_id",
    "tr"."store_id",
    "tr"."deck_id",
    "tr"."player_id",
    "tr"."tournament_date",
    "date_trunc"('month'::"text", ("tr"."tournament_date")::timestamp with time zone) AS "month",
    "tr"."placement",
    "tr"."total_players",
    "s"."name" AS "store",
    "d"."name" AS "deck",
    "p"."name" AS "player",
    COALESCE("f"."code", 'UNSPECIFIED'::"text") AS "format_code",
        CASE
            WHEN ("tr"."placement" = 1) THEN 15
            WHEN ("tr"."placement" = 2) THEN 10
            WHEN ("tr"."placement" = 3) THEN 7
            WHEN ("tr"."placement" = 4) THEN 5
            WHEN ("tr"."placement" <= 8) THEN 3
            WHEN ("tr"."placement" <= 16) THEN 1
            ELSE 0
        END AS "ranking_points",
        CASE
            WHEN ("tr"."placement" = 1) THEN 1
            ELSE 0
        END AS "is_title",
        CASE
            WHEN ("tr"."placement" <= 4) THEN 1
            ELSE 0
        END AS "is_top4",
        CASE
            WHEN ("tr"."placement" <= LEAST(8, COALESCE(("tr"."total_players")::integer, 8))) THEN 1
            ELSE 0
        END AS "is_top8",
        CASE
            WHEN ("tr"."placement" <= LEAST(16, COALESCE(("tr"."total_players")::integer, 16))) THEN 1
            ELSE 0
        END AS "is_top16"
   FROM ((((("public"."tournament_results" "tr"
     JOIN "public"."stores" "s" ON (("s"."id" = "tr"."store_id")))
     JOIN "public"."decks" "d" ON (("d"."id" = "tr"."deck_id")))
     LEFT JOIN "public"."players" "p" ON (("p"."id" = "tr"."player_id")))
     LEFT JOIN "public"."tournament" "t" ON (("t"."id" = "tr"."tournament_id")))
     LEFT JOIN "public"."formats" "f" ON (("f"."id" = "t"."format_id")));


ALTER VIEW "public"."v_stats_base" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_store_champions" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "s"."name" AS "store_name",
            "p"."name" AS "player_name",
            "tr"."placement"
           FROM (("public"."tournament_results" "tr"
             JOIN "public"."stores" "s" ON (("s"."id" = "tr"."store_id")))
             JOIN "public"."players" "p" ON (("p"."id" = "tr"."player_id")))
        ), "scored" AS (
         SELECT "b"."store_name",
            "b"."player_name",
            "b"."placement",
                CASE
                    WHEN ("b"."placement" = 1) THEN 15
                    WHEN ("b"."placement" = 2) THEN 10
                    WHEN ("b"."placement" = 3) THEN 7
                    WHEN ("b"."placement" = 4) THEN 5
                    ELSE 0
                END AS "placement_points"
           FROM "base" "b"
        ), "agg" AS (
         SELECT "s"."store_name",
            "s"."player_name",
            "count"(*) AS "entries",
            "sum"(
                CASE
                    WHEN ("s"."placement" = 1) THEN 1
                    ELSE 0
                END) AS "titles",
            "sum"(
                CASE
                    WHEN ("s"."placement" <= 4) THEN 1
                    ELSE 0
                END) AS "top4_total",
            "sum"("s"."placement_points") AS "ranking_points",
            "round"("avg"(("s"."placement")::numeric), 2) AS "avg_placement"
           FROM "scored" "s"
          GROUP BY "s"."store_name", "s"."player_name"
        )
 SELECT "store_name" AS "store",
    "player_name" AS "player",
    "titles",
    "entries",
    "top4_total",
    "ranking_points",
    "avg_placement",
    "round"(((100.0 * ("titles")::numeric) / NULLIF("sum"("titles") OVER (PARTITION BY "store_name"), (0)::numeric)), 2) AS "store_title_share_percent",
    "dense_rank"() OVER (PARTITION BY "store_name" ORDER BY "titles" DESC, "ranking_points" DESC, "entries" DESC) AS "store_rank"
   FROM "agg" "a"
  ORDER BY "store_name", ("dense_rank"() OVER (PARTITION BY "store_name" ORDER BY "titles" DESC, "ranking_points" DESC, "entries" DESC)), "player_name";


ALTER VIEW "public"."v_store_champions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_top_cards_by_month" WITH ("security_invoker"='true') AS
 WITH "base" AS (
         SELECT "date_trunc"('month'::"text", ("tr"."tournament_date")::timestamp with time zone) AS "month",
            "tr"."placement",
            "dl"."id" AS "decklist_id",
            "dc"."card_code",
            "dc"."qty",
            "meta"."card_type",
            "meta"."card_level",
            "meta"."is_digi_egg",
            "meta"."is_staple"
           FROM ((("public"."tournament_results" "tr"
             JOIN "public"."decklists" "dl" ON (("dl"."tournament_result_id" = "tr"."id")))
             JOIN "public"."decklist_cards" "dc" ON (("dc"."decklist_id" = "dl"."id")))
             LEFT JOIN "public"."decklist_card_metadata" "meta" ON (("meta"."card_code" = "dc"."card_code")))
          WHERE ("tr"."placement" <= 4)
        ), "agg" AS (
         SELECT "b"."month",
            "b"."card_code",
            "max"("b"."card_type") FILTER (WHERE ("b"."card_type" IS NOT NULL)) AS "card_type",
            "max"("b"."card_level") AS "card_level",
            "bool_or"("b"."is_digi_egg") AS "is_digi_egg",
            "bool_or"("b"."is_staple") AS "is_staple",
            "count"(DISTINCT "b"."decklist_id") AS "decklists_with_card",
            "sum"("b"."qty") AS "total_copies",
            "sum"(
                CASE
                    WHEN ("b"."placement" = 1) THEN "b"."qty"
                    ELSE 0
                END) AS "champion_copies",
            "sum"(
                CASE
                    WHEN ("b"."placement" <= 2) THEN "b"."qty"
                    ELSE 0
                END) AS "top2_copies",
            "sum"(
                CASE
                    WHEN ("b"."placement" <= 3) THEN "b"."qty"
                    ELSE 0
                END) AS "top3_copies",
            "sum"(
                CASE
                    WHEN ("b"."placement" <= 4) THEN "b"."qty"
                    ELSE 0
                END) AS "top4_copies"
           FROM "base" "b"
          GROUP BY "b"."month", "b"."card_code"
        )
 SELECT "month",
    "card_code",
    "card_type",
    "card_level",
    "is_digi_egg",
    "is_staple",
    "decklists_with_card",
    "total_copies",
    "champion_copies",
    "top2_copies",
    "top3_copies",
    "top4_copies",
    "dense_rank"() OVER (PARTITION BY "month" ORDER BY "total_copies" DESC, "decklists_with_card" DESC, "card_code") AS "monthly_rank"
   FROM "agg" "a"
  ORDER BY "month" DESC, ("dense_rank"() OVER (PARTITION BY "month" ORDER BY "total_copies" DESC, "decklists_with_card" DESC, "card_code")), "card_code";


ALTER VIEW "public"."v_top_cards_by_month" OWNER TO "postgres";


ALTER TABLE ONLY "public"."decklist_cards" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."decklist_cards_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."decklists" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."decklists_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cards_cache"
    ADD CONSTRAINT "cards_cache_pkey" PRIMARY KEY ("card_code");



ALTER TABLE ONLY "public"."deck_images"
    ADD CONSTRAINT "deck_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decklist_card_metadata"
    ADD CONSTRAINT "decklist_card_metadata_pkey" PRIMARY KEY ("card_code");



ALTER TABLE ONLY "public"."decklist_cards"
    ADD CONSTRAINT "decklist_cards_decklist_id_card_code_key" UNIQUE ("decklist_id", "card_code");



ALTER TABLE ONLY "public"."decklist_cards"
    ADD CONSTRAINT "decklist_cards_decklist_id_position_key" UNIQUE ("decklist_id", "position");



ALTER TABLE ONLY "public"."decklist_cards"
    ADD CONSTRAINT "decklist_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decklists"
    ADD CONSTRAINT "decklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decklists"
    ADD CONSTRAINT "decklists_tournament_result_id_key" UNIQUE ("tournament_result_id");



ALTER TABLE ONLY "public"."decks"
    ADD CONSTRAINT "decks_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."decks"
    ADD CONSTRAINT "decks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."formats"
    ADD CONSTRAINT "formats_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."formats"
    ADD CONSTRAINT "formats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament"
    ADD CONSTRAINT "tournament_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_results"
    ADD CONSTRAINT "tournament_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_results"
    ADD CONSTRAINT "unique_player_per_tournament" UNIQUE ("store_id", "tournament_date", "player_id");



ALTER TABLE ONLY "public"."tournament_results"
    ADD CONSTRAINT "unique_tournament_placement" UNIQUE ("store_id", "tournament_date", "placement");



ALTER TABLE ONLY "public"."decklist_cards"
    ADD CONSTRAINT "uq_decklist_cards_code" UNIQUE ("decklist_id", "card_code");



ALTER TABLE ONLY "public"."decklist_cards"
    ADD CONSTRAINT "uq_decklist_cards_position" UNIQUE ("decklist_id", "position");



CREATE INDEX "idx_cards_cache_updated_at" ON "public"."cards_cache" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_decklist_cards_card_code" ON "public"."decklist_cards" USING "btree" ("card_code");



CREATE INDEX "idx_decklist_cards_decklist_card_code" ON "public"."decklist_cards" USING "btree" ("decklist_id", "card_code");



CREATE INDEX "idx_decklist_cards_decklist_id" ON "public"."decklist_cards" USING "btree" ("decklist_id");



CREATE INDEX "idx_decklist_cards_decklist_position" ON "public"."decklist_cards" USING "btree" ("decklist_id", "position");



CREATE INDEX "idx_decklists_tournament_result_id" ON "public"."decklists" USING "btree" ("tournament_result_id");



CREATE UNIQUE INDEX "idx_players_bandai_id" ON "public"."players" USING "btree" ("bandai_id") WHERE ("bandai_id" IS NOT NULL);



CREATE INDEX "idx_players_bandai_nick" ON "public"."players" USING "btree" ("lower"("bandai_nick")) WHERE ("bandai_nick" IS NOT NULL);



CREATE INDEX "idx_results_date" ON "public"."tournament_results" USING "btree" ("tournament_date");



CREATE INDEX "idx_results_deck" ON "public"."tournament_results" USING "btree" ("deck_id");



CREATE INDEX "idx_results_store" ON "public"."tournament_results" USING "btree" ("store_id");



CREATE INDEX "idx_top8_results" ON "public"."tournament_results" USING "btree" ("placement") WHERE ("placement" <= 8);



CREATE INDEX "idx_tournament_format_id" ON "public"."tournament" USING "btree" ("format_id");



CREATE UNIQUE INDEX "uq_formats_single_default" ON "public"."formats" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE OR REPLACE TRIGGER "trg_decklist_cards_updated_at" BEFORE UPDATE ON "public"."decklist_cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_decklists_updated_at" BEFORE UPDATE ON "public"."decklists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_formats_single_default" BEFORE INSERT OR UPDATE OF "is_default" ON "public"."formats" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_default_format"();



CREATE OR REPLACE TRIGGER "trg_sync_date_after_tournament_update" AFTER UPDATE OF "tournament_date" ON "public"."tournament" FOR EACH ROW EXECUTE FUNCTION "public"."sync_tournament_date_to_results"();



CREATE OR REPLACE TRIGGER "trg_touch_decklist_card_metadata_updated_at" BEFORE UPDATE ON "public"."decklist_card_metadata" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_decklist_cards_updated_at" BEFORE UPDATE ON "public"."decklist_cards" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_decklists_updated_at" BEFORE UPDATE ON "public"."decklists" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE CONSTRAINT TRIGGER "trg_validate_decklist_limits_del" AFTER DELETE ON "public"."decklist_cards" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."validate_decklist_limits"();



CREATE CONSTRAINT TRIGGER "trg_validate_decklist_limits_insupd" AFTER INSERT OR UPDATE ON "public"."decklist_cards" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."validate_decklist_limits"();



ALTER TABLE ONLY "public"."decklist_cards"
    ADD CONSTRAINT "decklist_cards_decklist_id_fkey" FOREIGN KEY ("decklist_id") REFERENCES "public"."decklists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."decklists"
    ADD CONSTRAINT "decklists_tournament_result_id_fkey" FOREIGN KEY ("tournament_result_id") REFERENCES "public"."tournament_results"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deck_images"
    ADD CONSTRAINT "fk_deck" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_results"
    ADD CONSTRAINT "fk_deck" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id");



ALTER TABLE ONLY "public"."decklist_cards"
    ADD CONSTRAINT "fk_decklist_cards_card_code_metadata" FOREIGN KEY ("card_code") REFERENCES "public"."decklist_card_metadata"("card_code") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tournament_results"
    ADD CONSTRAINT "fk_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id");



ALTER TABLE ONLY "public"."tournament_results"
    ADD CONSTRAINT "fk_store" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."tournament"
    ADD CONSTRAINT "tournament_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "public"."formats"("id") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."tournament_results"
    ADD CONSTRAINT "tournament_results_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id");



ALTER TABLE ONLY "public"."tournament"
    ADD CONSTRAINT "tournament_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



CREATE POLICY "Allow anonymous delete" ON "public"."deck_images" FOR DELETE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous delete" ON "public"."decks" FOR DELETE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous delete" ON "public"."tournament_results" FOR DELETE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous delete decklist card metadata" ON "public"."decklist_card_metadata" FOR DELETE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous delete decklist cards" ON "public"."decklist_cards" FOR DELETE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous delete decklists" ON "public"."decklists" FOR DELETE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert" ON "public"."deck_images" FOR INSERT WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert" ON "public"."decks" FOR INSERT WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert" ON "public"."tournament" FOR INSERT WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert" ON "public"."tournament_results" FOR INSERT TO "anon" WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert cards cache" ON "public"."cards_cache" FOR INSERT TO "anon" WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert decklist card metadata" ON "public"."decklist_card_metadata" FOR INSERT TO "anon" WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert decklist cards" ON "public"."decklist_cards" FOR INSERT TO "anon" WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert decklists" ON "public"."decklists" FOR INSERT TO "anon" WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous insert formats" ON "public"."formats" FOR INSERT WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous select" ON "public"."deck_images" FOR SELECT USING (true);



CREATE POLICY "Allow anonymous select" ON "public"."decks" FOR SELECT USING (true);



CREATE POLICY "Allow anonymous select" ON "public"."tournament" FOR SELECT USING (true);



CREATE POLICY "Allow anonymous select" ON "public"."tournament_results" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow anonymous select cards cache" ON "public"."cards_cache" FOR SELECT TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous select decklist card metadata" ON "public"."decklist_card_metadata" FOR SELECT TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous select decklist cards" ON "public"."decklist_cards" FOR SELECT TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous select decklists" ON "public"."decklists" FOR SELECT TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous select formats" ON "public"."formats" FOR SELECT USING (true);



CREATE POLICY "Allow anonymous update" ON "public"."deck_images" FOR UPDATE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update" ON "public"."decks" FOR UPDATE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update" ON "public"."tournament" FOR UPDATE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update" ON "public"."tournament_results" FOR UPDATE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update cards cache" ON "public"."cards_cache" FOR UPDATE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update decklist card metadata" ON "public"."decklist_card_metadata" FOR UPDATE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update decklist cards" ON "public"."decklist_cards" FOR UPDATE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update decklists" ON "public"."decklists" FOR UPDATE TO "anon" USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow anonymous update formats" ON "public"."formats" FOR UPDATE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow public delete" ON "public"."players" FOR DELETE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow public insert" ON "public"."players" FOR INSERT WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Allow public select" ON "public"."players" FOR SELECT USING (true);



CREATE POLICY "Allow public update" ON "public"."players" FOR UPDATE USING (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"]))) WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Public insert tournament results" ON "public"."tournament_results" FOR INSERT WITH CHECK (("auth"."role"() = ANY (ARRAY['anon'::"text", 'authenticated'::"text"])));



CREATE POLICY "Public read deck images" ON "public"."deck_images" FOR SELECT USING (true);



CREATE POLICY "Public read decks" ON "public"."decks" FOR SELECT USING (true);



CREATE POLICY "Public read results" ON "public"."tournament_results" FOR SELECT USING (true);



CREATE POLICY "Public read stores" ON "public"."stores" FOR SELECT USING (true);



CREATE POLICY "Public read tournament results" ON "public"."tournament_results" FOR SELECT USING (true);



ALTER TABLE "public"."cards_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deck_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decklist_card_metadata" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decklist_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."formats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_results" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_format"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_format"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_format"() TO "service_role";



GRANT ALL ON FUNCTION "public"."match_player_bandai"("p_bandai_id" "text", "p_bandai_nick" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."match_player_bandai"("p_bandai_id" "text", "p_bandai_nick" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_player_bandai"("p_bandai_id" "text", "p_bandai_nick" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_tournament_date_to_results"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_tournament_date_to_results"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_tournament_date_to_results"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_decklist_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_decklist_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_decklist_limits"() TO "service_role";



GRANT ALL ON TABLE "public"."cards_cache" TO "anon";
GRANT ALL ON TABLE "public"."cards_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."cards_cache" TO "service_role";



GRANT ALL ON TABLE "public"."deck_images" TO "anon";
GRANT ALL ON TABLE "public"."deck_images" TO "authenticated";
GRANT ALL ON TABLE "public"."deck_images" TO "service_role";



GRANT ALL ON TABLE "public"."decklist_card_metadata" TO "anon";
GRANT ALL ON TABLE "public"."decklist_card_metadata" TO "authenticated";
GRANT ALL ON TABLE "public"."decklist_card_metadata" TO "service_role";



GRANT ALL ON TABLE "public"."decklist_cards" TO "anon";
GRANT ALL ON TABLE "public"."decklist_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."decklist_cards" TO "service_role";



GRANT ALL ON SEQUENCE "public"."decklist_cards_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."decklist_cards_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."decklist_cards_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."decklists" TO "anon";
GRANT ALL ON TABLE "public"."decklists" TO "authenticated";
GRANT ALL ON TABLE "public"."decklists" TO "service_role";



GRANT ALL ON SEQUENCE "public"."decklists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."decklists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."decklists_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."decks" TO "anon";
GRANT ALL ON TABLE "public"."decks" TO "authenticated";
GRANT ALL ON TABLE "public"."decks" TO "service_role";



GRANT ALL ON TABLE "public"."formats" TO "anon";
GRANT ALL ON TABLE "public"."formats" TO "authenticated";
GRANT ALL ON TABLE "public"."formats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."formats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."formats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."formats_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."tournament" TO "anon";
GRANT ALL ON TABLE "public"."tournament" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournament_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournament_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournament_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_results" TO "anon";
GRANT ALL ON TABLE "public"."tournament_results" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_results" TO "service_role";



GRANT ALL ON TABLE "public"."v_deck_rank" TO "anon";
GRANT ALL ON TABLE "public"."v_deck_rank" TO "authenticated";
GRANT ALL ON TABLE "public"."v_deck_rank" TO "service_role";



GRANT ALL ON TABLE "public"."v_deck_representation" TO "anon";
GRANT ALL ON TABLE "public"."v_deck_representation" TO "authenticated";
GRANT ALL ON TABLE "public"."v_deck_representation" TO "service_role";



GRANT ALL ON TABLE "public"."v_deck_stats" TO "anon";
GRANT ALL ON TABLE "public"."v_deck_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."v_deck_stats" TO "service_role";



GRANT ALL ON TABLE "public"."v_decklist_cards_enriched" TO "anon";
GRANT ALL ON TABLE "public"."v_decklist_cards_enriched" TO "authenticated";
GRANT ALL ON TABLE "public"."v_decklist_cards_enriched" TO "service_role";



GRANT ALL ON TABLE "public"."v_meta_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_meta_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_meta_by_month" TO "service_role";



GRANT ALL ON TABLE "public"."v_monthly_ranking" TO "anon";
GRANT ALL ON TABLE "public"."v_monthly_ranking" TO "authenticated";
GRANT ALL ON TABLE "public"."v_monthly_ranking" TO "service_role";



GRANT ALL ON TABLE "public"."v_player_ranking" TO "anon";
GRANT ALL ON TABLE "public"."v_player_ranking" TO "authenticated";
GRANT ALL ON TABLE "public"."v_player_ranking" TO "service_role";



GRANT ALL ON TABLE "public"."v_podium" TO "anon";
GRANT ALL ON TABLE "public"."v_podium" TO "authenticated";
GRANT ALL ON TABLE "public"."v_podium" TO "service_role";



GRANT ALL ON TABLE "public"."v_podium_full" TO "anon";
GRANT ALL ON TABLE "public"."v_podium_full" TO "authenticated";
GRANT ALL ON TABLE "public"."v_podium_full" TO "service_role";



GRANT ALL ON TABLE "public"."v_stats_base" TO "anon";
GRANT ALL ON TABLE "public"."v_stats_base" TO "authenticated";
GRANT ALL ON TABLE "public"."v_stats_base" TO "service_role";



GRANT ALL ON TABLE "public"."v_store_champions" TO "anon";
GRANT ALL ON TABLE "public"."v_store_champions" TO "authenticated";
GRANT ALL ON TABLE "public"."v_store_champions" TO "service_role";



GRANT ALL ON TABLE "public"."v_top_cards_by_month" TO "anon";
GRANT ALL ON TABLE "public"."v_top_cards_by_month" TO "authenticated";
GRANT ALL ON TABLE "public"."v_top_cards_by_month" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







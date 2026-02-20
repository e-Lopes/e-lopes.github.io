-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.decks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT decks_pkey PRIMARY KEY (id)
);

CREATE TABLE public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stores_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tournament (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tournament_name text,
  tournament_date date,
  store_id uuid,
  total_players smallint,
  instagram_link text,
  CONSTRAINT tournament_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);

CREATE TABLE public.deck_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL,
  image_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deck_images_pkey PRIMARY KEY (id),
  CONSTRAINT fk_deck FOREIGN KEY (deck_id) REFERENCES public.decks(id)
);

CREATE TABLE public.tournament_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  store_id uuid NOT NULL,
  tournament_date date NOT NULL,
  total_players smallint NOT NULL CHECK (total_players > 0),
  placement smallint NOT NULL CHECK (placement > 0),
  deck_id uuid NOT NULL,
  decklist text,
  player_id uuid,
  tournament_id bigint,
  CONSTRAINT tournament_results_pkey PRIMARY KEY (id),
  CONSTRAINT fk_store FOREIGN KEY (store_id) REFERENCES public.stores(id),
  CONSTRAINT fk_deck FOREIGN KEY (deck_id) REFERENCES public.decks(id),
  CONSTRAINT fk_player FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT tournament_results_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournament(id)
);

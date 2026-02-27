-- =============================================================
-- Migração: adiciona colunas Bandai na tabela players
-- =============================================================

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS bandai_id   TEXT,
  ADD COLUMN IF NOT EXISTS bandai_nick TEXT;

-- Índice para busca rápida por bandai_id (member number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_bandai_id
  ON players (bandai_id)
  WHERE bandai_id IS NOT NULL;

-- Índice para busca por nick (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_players_bandai_nick
  ON players (LOWER(bandai_nick))
  WHERE bandai_nick IS NOT NULL;

-- =============================================================
-- Função de matching: recebe member_id e nick do OCR,
-- retorna o player correspondente.
-- Prioridade: bandai_id > bandai_nick > name
-- =============================================================

CREATE OR REPLACE FUNCTION match_player_bandai(
  p_bandai_id   TEXT,
  p_bandai_nick TEXT
)
RETURNS TABLE (
  id          UUID,
  name        TEXT,
  bandai_id   TEXT,
  bandai_nick TEXT,
  match_type  TEXT   -- como foi encontrado
)
LANGUAGE plpgsql AS $$
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

-- =============================================================
-- Exemplos de uso:
-- =============================================================

-- Buscar jogador pelo member number:
-- SELECT * FROM match_player_bandai('0000238403', 'Edu');

-- Buscar jogador GUEST pelo nick:
-- SELECT * FROM match_player_bandai('GUEST99999', 'Basno');

-- Atualizar bandai_id e bandai_nick de um jogador manualmente:
-- UPDATE players
--   SET bandai_id = '0000238403', bandai_nick = 'Edu'
--   WHERE id = '65ac1069-e647-4781-9216-7e0e8e5a0563';

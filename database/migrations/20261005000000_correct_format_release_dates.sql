begin;

-- Official English product release dates, verified on 2026-10-05.
-- The project uses each set as a format/metagame period.
-- Requested convention: overwrite created_at with the release date,
-- excluding pre-release events and Japanese release dates.
-- Sources and catalog scope: docs/data/format-release-dates.md.
-- Midnight in Curitiba is a date-storage convention, not a known release hour.
-- Update existing codes only; do not create formats or change the default,
-- activation, IDs, backgrounds, or tournament relationships.
-- Also set readable product names for the requested "Name - Code" filters.

with official_releases (code, name, release_date) as (
    values
        -- https://world.digimoncard.com/products/pack/ver14/special/
        ('BT14', 'Blast Ace', date '2023-11-17'),
        -- https://world.digimoncard.com/products/pack/ver18-19/
        ('RSB2.0', 'Release Special Booster 2.0', date '2024-11-01'),
        -- https://world.digimoncard.com/products/pack/ver19-20/
        ('RSB2.5', 'Release Special Booster 2.5', date '2025-02-28'),
        -- https://world.digimoncard.com/products/pack/ver21/
        ('BT21', 'World Convergence', date '2025-04-25'),
        -- https://world.digimoncard.com/products/pack/ex-09/
        -- Researched from the user's list; update only if already registered.
        ('EX09', 'Versus Monsters', date '2025-06-26'),
        -- https://world.digimoncard.com/products/pack/ver22/
        ('BT22', 'Cyber Eden', date '2025-07-25'),
        -- https://world.digimoncard.com/products/pack/ex-10/
        ('EX10', 'Sinister Order', date '2025-09-19'),
        -- https://world.digimoncard.com/products/pack/ver23/
        ('BT23', 'Hackers'' Slumber', date '2025-10-24'),
        -- https://world.digimoncard.com/products/pack/ver24/
        ('BT24', 'Time Stranger', date '2026-01-23'),
        -- https://world.digimoncard.com/products/pack/ex-11/
        ('EX11', 'Dawn of Liberator', date '2026-02-13'),
        -- https://world.digimoncard.com/products/pack/ad-01/
        ('AD01', 'Digimon Generation', date '2026-03-27'),
        -- https://world.digimoncard.com/products/pack/ver25/
        ('BT25', 'Dual Revolution', date '2026-05-22'),
        -- https://world.digimoncard.com/products/pack/ex-12/
        ('EX12', 'Digital World Shambala', date '2026-07-03'),
        -- https://world.digimoncard.com/products/pack/ver26/
        ('BT26', 'Timeless Bonds', date '2026-09-04'),
        -- https://world.digimoncard.com/products/pack/ex-13/
        ('EX13', 'Chivalrous XIII', date '2026-10-02')
)
update public.formats as f
set created_at = r.release_date::timestamp at time zone 'America/Sao_Paulo',
    name = r.name
from official_releases as r
where upper(btrim(f.code)) = r.code
  and (f.created_at is distinct from
      (r.release_date::timestamp at time zone 'America/Sao_Paulo')
      or f.name is distinct from r.name);

commit;

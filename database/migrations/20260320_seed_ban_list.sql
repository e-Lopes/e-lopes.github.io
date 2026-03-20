-- Migration: 2026-03-20 (seed)
-- Populate ban_list with the hardcoded values previously in the decklist builder

INSERT INTO public.ban_list (card_code, restriction, notes) VALUES
    -- Banned (cannot be used at all)
    ('BT2-090', 'banned',  'Previously hardcoded'),
    ('BT5-109', 'banned',  'Previously hardcoded'),
    ('EX5-065', 'banned',  'Previously hardcoded'),

    -- Limited (max 1 copy)
    ('BT1-090',  'limited', 'Previously hardcoded'),
    ('BT10-009', 'limited', 'Previously hardcoded'),
    ('BT11-033', 'limited', 'Previously hardcoded'),
    ('BT11-064', 'limited', 'Previously hardcoded'),
    ('BT13-012', 'limited', 'Previously hardcoded'),
    ('BT13-110', 'limited', 'Previously hardcoded'),
    ('BT14-002', 'limited', 'Previously hardcoded'),
    ('BT14-084', 'limited', 'Previously hardcoded'),
    ('BT15-057', 'limited', 'Previously hardcoded'),
    ('BT15-102', 'limited', 'Previously hardcoded'),
    ('BT16-011', 'limited', 'Previously hardcoded'),
    ('BT17-069', 'limited', 'Previously hardcoded'),
    ('BT19-040', 'limited', 'Previously hardcoded'),
    ('BT2-047',  'limited', 'Previously hardcoded'),
    ('BT3-054',  'limited', 'Previously hardcoded'),
    ('BT3-103',  'limited', 'Previously hardcoded'),
    ('BT4-104',  'limited', 'Previously hardcoded'),
    ('BT4-111',  'limited', 'Previously hardcoded'),
    ('BT6-100',  'limited', 'Previously hardcoded'),
    ('BT6-104',  'limited', 'Previously hardcoded'),
    ('BT7-038',  'limited', 'Previously hardcoded'),
    ('BT7-064',  'limited', 'Previously hardcoded'),
    ('BT7-069',  'limited', 'Previously hardcoded'),
    ('BT7-072',  'limited', 'Previously hardcoded'),
    ('BT7-107',  'limited', 'Previously hardcoded'),
    ('BT9-098',  'limited', 'Previously hardcoded'),
    ('BT9-099',  'limited', 'Previously hardcoded'),
    ('EX1-021',  'limited', 'Previously hardcoded'),
    ('EX1-068',  'limited', 'Previously hardcoded'),
    ('EX2-039',  'limited', 'Previously hardcoded'),
    ('EX2-070',  'limited', 'Previously hardcoded'),
    ('EX3-057',  'limited', 'Previously hardcoded'),
    ('EX4-006',  'limited', 'Previously hardcoded'),
    ('EX4-019',  'limited', 'Previously hardcoded'),
    ('EX4-030',  'limited', 'Previously hardcoded'),
    ('EX5-015',  'limited', 'Previously hardcoded'),
    ('EX5-018',  'limited', 'Previously hardcoded'),
    ('EX5-062',  'limited', 'Previously hardcoded'),
    ('P-008',    'limited', 'Previously hardcoded'),
    ('P-025',    'limited', 'Previously hardcoded'),
    ('P-029',    'limited', 'Previously hardcoded'),
    ('P-030',    'limited', 'Previously hardcoded'),
    ('P-123',    'limited', 'Previously hardcoded'),
    ('P-130',    'limited', 'Previously hardcoded'),
    ('ST2-13',   'limited', 'Previously hardcoded'),
    ('ST9-09',   'limited', 'Previously hardcoded'),

    -- Choice-restricted (unique cards from CHOICE_RESTRICTION_GROUPS)
    -- Groups: [BT20-037, EX8-037], [BT20-037, BT17-035], [EX7-064, EX2-007]
    ('BT20-037', 'choice-restricted', 'Choice group: cannot use with EX8-037 or BT17-035'),
    ('EX8-037',  'choice-restricted', 'Choice group: cannot use with BT20-037'),
    ('BT17-035', 'choice-restricted', 'Choice group: cannot use with BT20-037'),
    ('EX7-064',  'choice-restricted', 'Choice group: cannot use with EX2-007'),
    ('EX2-007',  'choice-restricted', 'Choice group: cannot use with EX7-064')

ON CONFLICT (card_code) DO NOTHING;

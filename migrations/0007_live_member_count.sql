-- The homepage "50+ Student members" stat now counts this season's roster.
-- "{members}" in a stat value is replaced with the count, rounded down to the
-- nearest 10 (42 → "40+"). Only changes the stat if it still says 50+.
UPDATE site_settings
SET value = replace(value, '"value": "50+"', '"value": "{members}"')
WHERE key = 'stats';
UPDATE site_settings
SET value = replace(value, '"value":"50+"', '"value":"{members}"')
WHERE key = 'stats';

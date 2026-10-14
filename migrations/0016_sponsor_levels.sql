-- Sponsorship levels: what each tier asks for, what it pays for and what
-- sponsors get back. /sponsors compares them in a table; a tier with no
-- amount stays off that table.
ALTER TABLE sponsor_tiers ADD COLUMN amount TEXT NOT NULL DEFAULT '';
-- Lines under the amount, like a range or "or 3–9 mentors".
ALTER TABLE sponsor_tiers ADD COLUMN amount_note TEXT NOT NULL DEFAULT '';
-- JSON list of what the money pays for.
ALTER TABLE sponsor_tiers ADD COLUMN provides TEXT NOT NULL DEFAULT '[]';
-- JSON list of {label, value}: what sponsors get. The table lines tiers up by label.
ALTER TABLE sponsor_tiers ADD COLUMN benefits TEXT NOT NULL DEFAULT '[]';
-- How the sponsor wall shows this tier's sponsors.
ALTER TABLE sponsor_tiers ADD COLUMN logo_size TEXT NOT NULL DEFAULT 'small'
  CHECK (logo_size IN ('large', 'medium', 'small', 'name'));

-- The 2026 levels replace Gold, Silver and Bronze. Renaming keeps every
-- sponsor on the level they already had.
UPDATE sponsor_tiers SET name = 'Carbon Fiber'
WHERE name = 'Gold' AND NOT EXISTS (SELECT 1 FROM sponsor_tiers WHERE name = 'Carbon Fiber');
UPDATE sponsor_tiers SET name = 'Steel'
WHERE name = 'Silver' AND NOT EXISTS (SELECT 1 FROM sponsor_tiers WHERE name = 'Steel');
UPDATE sponsor_tiers SET name = 'Aluminum'
WHERE name = 'Bronze' AND NOT EXISTS (SELECT 1 FROM sponsor_tiers WHERE name = 'Aluminum');

INSERT INTO sponsor_tiers (name, rank) SELECT 'Titanium', 0 WHERE NOT EXISTS (SELECT 1 FROM sponsor_tiers WHERE name = 'Titanium');
INSERT INTO sponsor_tiers (name, rank) SELECT 'Carbon Fiber', 1 WHERE NOT EXISTS (SELECT 1 FROM sponsor_tiers WHERE name = 'Carbon Fiber');
INSERT INTO sponsor_tiers (name, rank) SELECT 'Steel', 2 WHERE NOT EXISTS (SELECT 1 FROM sponsor_tiers WHERE name = 'Steel');
INSERT INTO sponsor_tiers (name, rank) SELECT 'Aluminum', 3 WHERE NOT EXISTS (SELECT 1 FROM sponsor_tiers WHERE name = 'Aluminum');

UPDATE sponsor_tiers SET
  rank = 0,
  amount = '$10,000+',
  amount_note = 'or 10+ mentors' || char(10) || 'or a workspace',
  provides = json('["Annual registration fees for FRC competitions","Building materials for the robot and space for testing"]'),
  benefits = json('[{"label":"Team shirt","value":"Several"},{"label":"Logo on team shirt","value":""},{"label":"Name on website","value":""},{"label":"Logo on robot","value":""},{"label":"Logo in pit area","value":""},{"label":"Team robot demonstration","value":""}]'),
  logo_size = 'large'
WHERE name = 'Titanium';

UPDATE sponsor_tiers SET
  rank = 1,
  amount = '$5,000+',
  amount_note = '$5,000–$9,999' || char(10) || 'or 3–9 mentors',
  provides = json('["Transportation to competitions","Building materials for the robot","Competition equipment"]'),
  benefits = json('[{"label":"Team shirt","value":"Several"},{"label":"Logo on team shirt","value":""},{"label":"Name on website","value":""},{"label":"Logo on robot","value":""}]'),
  logo_size = 'medium'
WHERE name = 'Carbon Fiber';

UPDATE sponsor_tiers SET
  rank = 2,
  amount = '$500+',
  amount_note = '$500–$4,999' || char(10) || 'or 1–2 mentors',
  provides = json('["Large tools and electronics","Meals for students during build season"]'),
  benefits = json('[{"label":"Team shirt","value":"One"},{"label":"Logo on team shirt","value":""},{"label":"Name on website","value":""}]'),
  logo_size = 'small'
WHERE name = 'Steel';

UPDATE sponsor_tiers SET
  rank = 3,
  amount = '$25+',
  amount_note = '$25–$499',
  provides = json('["Daily hand tools","Sends one student to a competition"]'),
  benefits = json('[{"label":"Team shirt","value":"One"},{"label":"Name on website","value":""}]'),
  logo_size = 'name'
WHERE name = 'Aluminum';

-- Gifts that aren't money, listed on /sponsors.
INSERT INTO site_settings (key, value) VALUES ('sponsor_in_kind', json('["Free or reduced-price merchandise","Volunteering time with students as a mentor","Use of an enclosed trailer to haul equipment to competitions","Snacks for team events and travel","CAD (computer drafting) instruction, like Autodesk"]'))
ON CONFLICT(key) DO NOTHING;

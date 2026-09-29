-- 2026 branding guidelines.

-- Engineering notebook for each season: an uploaded PDF, a link, or both.
ALTER TABLE seasons ADD COLUMN notebook_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE seasons ADD COLUMN notebook_url TEXT;

-- The name is one word with a capital R and H: RoboHornets.
UPDATE site_settings
SET value = json_set(value, '$.titleBottom', 'Hornets')
WHERE key = 'hero' AND json_extract(value, '$.titleBottom') = 'hornets';

INSERT OR IGNORE INTO site_settings (key, value) VALUES
('mission', '"With the support of mentors and staff, our student-led organization fosters important life skills by immersing our members in the design process and non-profit management to prepare them for the future."'),
('values', '[
  {"title": "Discovery", "body": "We explore new skills and ideas."},
  {"title": "Innovation", "body": "We use creativity and persistence to solve problems."},
  {"title": "Impact", "body": "We apply what we learn to improve our world."},
  {"title": "Inclusion", "body": "We respect each other and embrace our differences."},
  {"title": "Teamwork", "body": "We are stronger when we work together."},
  {"title": "Fun", "body": "We enjoy and celebrate what we do!"}
]'),
('strategic_plan', '{"summary": "Our Strategic Plan lays out where the team is headed: our goals for the robot, outreach, fundraising and growing the team, and how we will get there.", "media_id": null, "url": "", "updated": ""}');

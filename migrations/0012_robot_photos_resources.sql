-- 1. Robot photos come from an album (the slideshow on the season page).
-- Albums made for a robot are named "2026 robot: Roomba" and are ordinary
-- albums, so they also show in the Gallery.
ALTER TABLE robots ADD COLUMN album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL;

-- Robots that already have a photo get an album holding it, at the end of
-- the Gallery's order, so nothing on the site changes.
INSERT INTO albums (slug, title, description, season_year, published, sort_order)
SELECT r.season_year || '-robot-' || r.id, r.season_year || ' robot: ' || r.name, '', r.season_year, 1,
       (SELECT COALESCE(MAX(sort_order), 0) FROM albums) + r.id
FROM robots r
WHERE r.photo_media_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM albums a WHERE a.slug = r.season_year || '-robot-' || r.id);

UPDATE robots SET album_id = (SELECT a.id FROM albums a WHERE a.slug = robots.season_year || '-robot-' || robots.id)
WHERE photo_media_id IS NOT NULL AND album_id IS NULL;

INSERT OR IGNORE INTO album_photos (album_id, media_id, sort_order)
SELECT album_id, photo_media_id, 1 FROM robots WHERE album_id IS NOT NULL AND photo_media_id IS NOT NULL;

-- 2. A season's scouting can be shown on its public Scouting tab, once an
-- admin switches it on.
ALTER TABLE scouting_forms ADD COLUMN published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1));

-- 3. Resources: links and files on a season's Resources tab. season_year
-- NULL means a team document shown on every season (Strategic Plan,
-- branding guidelines). Code, CAD, the notebook and scouting are added
-- automatically and aren't stored here.
CREATE TABLE resources (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year  INTEGER REFERENCES seasons(year) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  url          TEXT,
  media_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX resources_by_season ON resources(season_year, sort_order);

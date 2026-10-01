-- Impact events: outreach posts and outreach events become one thing. An
-- outreach event (kind 'outreach', shown as an "impact event") keeps its
-- details, hours and who went, and can also have a story: an article in
-- Markdown, shown on its page once published. `recap` ("What we did") is
-- its summary. Its photos are its album (events.album_id).
ALTER TABLE events ADD COLUMN story TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN story_published INTEGER NOT NULL DEFAULT 0 CHECK (story_published IN (0, 1));

-- Where each old post went, so its old links (/news/<slug>, /impact/<slug>) still work.
ALTER TABLE posts ADD COLUMN event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;

-- Every outreach post becomes an impact event dated when it was published,
-- in its season, or else the season of that date (FRC seasons start in the
-- fall: June onward counts toward the next year), or else the current one.
-- Drafts become hidden events. `notes` briefly holds which post it was.
INSERT INTO events (season_year, name, kind, start_date, recap, story, story_published, hidden, album_id, notes)
SELECT season, title, 'outreach', day, excerpt, body, published, 1 - published, album_id, 'post:' || id
FROM (
  SELECT p.*, date(COALESCE(p.published_at, p.created_at)) AS day,
         COALESCE(
           (SELECT year FROM seasons WHERE year = p.season_year),
           (SELECT year FROM seasons WHERE year =
              CAST(strftime('%Y', COALESCE(p.published_at, p.created_at)) AS INTEGER)
              + (CAST(strftime('%m', COALESCE(p.published_at, p.created_at)) AS INTEGER) >= 6)),
           (SELECT year FROM seasons ORDER BY is_current DESC, year DESC LIMIT 1)
         ) AS season
  FROM posts p
  WHERE p.category = 'outreach' AND p.event_id IS NULL
)
WHERE season IS NOT NULL;

UPDATE posts SET event_id = (SELECT e.id FROM events e WHERE e.notes = 'post:' || posts.id)
WHERE event_id IS NULL AND EXISTS (SELECT 1 FROM events e WHERE e.notes = 'post:' || posts.id);
UPDATE events SET notes = '' WHERE notes LIKE 'post:%';

-- A post's own album is now its event's own album.
UPDATE albums SET slug = 'impact-' || (SELECT p.event_id FROM posts p WHERE p.album_id = albums.id AND p.event_id IS NOT NULL)
WHERE slug LIKE 'post-%' AND EXISTS (SELECT 1 FROM posts p WHERE p.album_id = albums.id AND p.event_id IS NOT NULL);

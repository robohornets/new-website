-- The Blue Alliance sync.
--
-- Events and matches keep two copies of every TBA-backed field:
--   * the normal columns hold what the public site shows, and
--   * `tba` (JSON) holds the latest values from TBA.
-- `overrides` (JSON array of column names) lists the fields an admin changed.
-- A sync only writes a column when it is NOT in `overrides`; "Reset to TBA"
-- removes the name and copies the TBA value back.

ALTER TABLE events ADD COLUMN website TEXT;
ALTER TABLE events ADD COLUMN webcast_url TEXT;
ALTER TABLE events ADD COLUMN timezone TEXT;
-- e.g. "Captain, Alliance 3" / "1st pick, Alliance 2"
ALTER TABLE events ADD COLUMN alliance TEXT NOT NULL DEFAULT '';
-- e.g. "Event winners" / "Eliminated in semifinals (2-2)"
ALTER TABLE events ADD COLUMN playoff_result TEXT NOT NULL DEFAULT '';
-- Admin-only extras shown on the public event page.
ALTER TABLE events ADD COLUMN recap TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN highlight_video_url TEXT;
ALTER TABLE events ADD COLUMN album_id INTEGER REFERENCES albums(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1));
ALTER TABLE events ADD COLUMN tba TEXT;
ALTER TABLE events ADD COLUMN overrides TEXT NOT NULL DEFAULT '[]';
ALTER TABLE events ADD COLUMN tba_synced_at TEXT;
CREATE UNIQUE INDEX events_tba_key ON events(tba_key) WHERE tba_key IS NOT NULL;

CREATE TABLE matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- TBA match key, e.g. 2026okok_qm12. NULL for matches added by hand.
  tba_key       TEXT UNIQUE,
  -- qm (qualification) | ef | qf | sf | f
  comp_level    TEXT NOT NULL DEFAULT 'qm',
  set_number    INTEGER NOT NULL DEFAULT 1,
  match_number  INTEGER NOT NULL DEFAULT 1,
  -- Unix seconds: when it was played (or scheduled).
  time          INTEGER,
  -- Team numbers, comma separated: "1209, 254, 1678"
  red_teams     TEXT NOT NULL DEFAULT '',
  blue_teams    TEXT NOT NULL DEFAULT '',
  red_score     INTEGER,
  blue_score    INTEGER,
  -- Which side 1209 was on: red | blue
  our_alliance  TEXT,
  -- win | loss | tie | '' (not played)
  result        TEXT NOT NULL DEFAULT '',
  video_url     TEXT,
  hidden        INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  tba           TEXT,
  overrides     TEXT NOT NULL DEFAULT '[]',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX matches_by_event ON matches(event_id, time);

-- ETags from TBA, so unchanged data isn't downloaded and processed again.
CREATE TABLE tba_cache (
  path        TEXT PRIMARY KEY,
  etag        TEXT,
  fetched_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- The two 2018 events in the starter content had no TBA key; the TBA history
-- import brings them back with real dates, results and matches.
DELETE FROM events
WHERE season_year = 2018 AND tba_key IS NULL
  AND name IN ('Arkansas Rock City Regional', 'Oklahoma Regional');

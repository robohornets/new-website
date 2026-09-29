-- RoboHornets site schema.
-- Content is organised around seasons: each FRC year gets a row in `seasons`,
-- and robots, events, roster entries, sponsor tiers, posts and albums hang off it.
-- Starting a new season in /admin adds a row here and carries over whatever is chosen.

-- Files stored in the R2 bucket (binding MEDIA). Everything that shows an image
-- points at a row here instead of storing raw keys.
CREATE TABLE media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key        TEXT NOT NULL UNIQUE,
  filename      TEXT NOT NULL,
  content_type  TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  alt           TEXT NOT NULL DEFAULT '',
  uploaded_by   TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Key/value text for the site: hero copy, about text, stats, socials, address.
-- Values are JSON so a setting can be a string, list or object.
CREATE TABLE site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE seasons (
  year              INTEGER PRIMARY KEY,
  game_name         TEXT NOT NULL DEFAULT '',
  summary           TEXT NOT NULL DEFAULT '',
  -- pre_kickoff | build | competition | offseason
  status            TEXT NOT NULL DEFAULT 'pre_kickoff'
                    CHECK (status IN ('pre_kickoff', 'build', 'competition', 'offseason')),
  kickoff_date      TEXT,
  reveal_video_url  TEXT,
  hero_media_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
  is_current        INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
-- At most one current season.
CREATE UNIQUE INDEX seasons_one_current ON seasons(is_current) WHERE is_current = 1;

CREATE TABLE robots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year     INTEGER NOT NULL REFERENCES seasons(year) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- competition | kitbot | offseason | prototype
  kind            TEXT NOT NULL DEFAULT 'competition'
                  CHECK (kind IN ('competition', 'kitbot', 'offseason', 'prototype')),
  description     TEXT NOT NULL DEFAULT '',
  -- JSON array of {"label": "...", "value": "..."}
  specs           TEXT NOT NULL DEFAULT '[]',
  -- JSON array of short tags shown as chips
  tags            TEXT NOT NULL DEFAULT '[]',
  code_url        TEXT,
  cad_url         TEXT,
  photo_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX robots_by_season ON robots(season_year, sort_order);

CREATE TABLE events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year     INTEGER NOT NULL REFERENCES seasons(year) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- regional | district | championship | offseason | outreach | other
  kind            TEXT NOT NULL DEFAULT 'regional'
                  CHECK (kind IN ('regional', 'district', 'championship', 'offseason', 'outreach', 'other')),
  location        TEXT NOT NULL DEFAULT '',
  start_date      TEXT,
  end_date        TEXT,
  -- The Blue Alliance event key, e.g. 2026okok
  tba_key         TEXT,
  rank            TEXT NOT NULL DEFAULT '',
  record          TEXT NOT NULL DEFAULT '',
  awards          TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT ''
);
CREATE INDEX events_by_season ON events(season_year, start_date);

-- A person exists once; roster_entries place them on a given season.
CREATE TABLE people (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL DEFAULT '',
  -- student | mentor
  kind            TEXT NOT NULL DEFAULT 'student' CHECK (kind IN ('student', 'mentor')),
  bio             TEXT NOT NULL DEFAULT '',
  photo_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  -- Student photos stay hidden unless this is switched on.
  show_photo      INTEGER NOT NULL DEFAULT 0 CHECK (show_photo IN (0, 1)),
  graduation_year INTEGER,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE roster_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year     INTEGER NOT NULL REFERENCES seasons(year) ON DELETE CASCADE,
  person_id       INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'Member',
  subteam         TEXT NOT NULL DEFAULT '',
  is_leadership   INTEGER NOT NULL DEFAULT 0 CHECK (is_leadership IN (0, 1)),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (season_year, person_id)
);
CREATE INDEX roster_by_season ON roster_entries(season_year, sort_order);

-- News and outreach articles. Body is Markdown (raw HTML is not rendered).
CREATE TABLE posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  -- news | outreach
  category        TEXT NOT NULL DEFAULT 'news' CHECK (category IN ('news', 'outreach')),
  excerpt         TEXT NOT NULL DEFAULT '',
  body            TEXT NOT NULL DEFAULT '',
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  season_year     INTEGER REFERENCES seasons(year) ON DELETE SET NULL,
  published       INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  published_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX posts_published ON posts(published, category, published_at DESC);

CREATE TABLE sponsor_tiers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  -- Lower rank shows first and larger.
  rank        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE sponsors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  url             TEXT,
  description     TEXT NOT NULL DEFAULT '',
  logo_media_id   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Which sponsors supported which season, and at what tier.
CREATE TABLE sponsor_seasons (
  sponsor_id   INTEGER NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  season_year  INTEGER NOT NULL REFERENCES seasons(year) ON DELETE CASCADE,
  tier_id      INTEGER NOT NULL REFERENCES sponsor_tiers(id),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sponsor_id, season_year)
);

CREATE TABLE albums (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  season_year     INTEGER REFERENCES seasons(year) ON DELETE SET NULL,
  cover_media_id  INTEGER REFERENCES media(id) ON DELETE SET NULL,
  published       INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE album_photos (
  album_id    INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  caption     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, media_id)
);

-- People listed on the Contact page (booster club, teacher sponsors).
CREATE TABLE contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Contact form submissions, read in /admin/messages.
CREATE TABLE messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  -- sponsorship | joining | donation | mentoring | other
  topic       TEXT NOT NULL DEFAULT 'other',
  body        TEXT NOT NULL,
  ip_hash     TEXT,
  read_at     TEXT,
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX messages_inbox ON messages(archived, created_at DESC);
CREATE INDEX messages_rate ON messages(ip_hash, created_at);

-- Who changed what in /admin.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Scouting: a public, team-by-team notebook for the competition season.
--
-- Each season has its own form (the game changes every year). The form has
-- two parts: Robot questions (one shared answer sheet per team, like a wiki
-- page) and Match report questions (any number of reports per team). The
-- public /scouting page only works while site_settings.scouting.open is on.
-- Anyone can add, edit or delete there; every change is kept in
-- scouting_history so an admin can put things back.

CREATE TABLE scouting_forms (
  season_year  INTEGER PRIMARY KEY REFERENCES seasons(year) ON DELETE CASCADE,
  -- JSON: { "robot": Field[], "match": Field[] }. See src/lib/scouting.ts.
  fields       TEXT NOT NULL DEFAULT '{"robot":[],"match":[]}',
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE scouting_entries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year  INTEGER NOT NULL,
  team_number  INTEGER NOT NULL,
  -- robot: the one shared robot sheet for this team and season
  -- report: a match report or general note
  kind         TEXT NOT NULL CHECK (kind IN ('robot', 'report')),
  event_key    TEXT,
  -- TBA match key (2026okok_qm12), or NULL for a general note.
  match_key    TEXT,
  -- JSON object of field id -> value.
  data         TEXT NOT NULL DEFAULT '{}',
  -- The typed name of whoever last saved it.
  scouter      TEXT NOT NULL DEFAULT '',
  -- Made on the phone, so a report saved offline and sent twice is only stored once.
  client_id    TEXT UNIQUE,
  deleted_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE UNIQUE INDEX scouting_one_robot_sheet ON scouting_entries(season_year, team_number) WHERE kind = 'robot';
CREATE INDEX scouting_by_team ON scouting_entries(season_year, team_number, kind);
CREATE INDEX scouting_by_event ON scouting_entries(event_key);

-- Every version an entry had before it was changed or deleted.
CREATE TABLE scouting_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id     INTEGER NOT NULL REFERENCES scouting_entries(id) ON DELETE CASCADE,
  -- edit | delete | restore
  action       TEXT NOT NULL,
  data         TEXT NOT NULL,
  match_key    TEXT,
  scouter      TEXT NOT NULL DEFAULT '',
  -- Who made this change (the typed name, or the admin's email).
  changed_by   TEXT NOT NULL DEFAULT '',
  changed_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX scouting_history_by_entry ON scouting_history(entry_id, changed_at);

-- The Blue Alliance data the scouting pages show (team names, rankings,
-- OPRs, match lists). Kept for a few minutes, then refreshed with an ETag.
CREATE TABLE tba_json_cache (
  path        TEXT PRIMARY KEY,
  etag        TEXT,
  body        TEXT NOT NULL,
  fetched_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Rate limiting for the public sync endpoint (hashed IPs, like the contact form).
CREATE TABLE scouting_writes (
  ip_hash     TEXT NOT NULL,
  ops         INTEGER NOT NULL DEFAULT 1,
  at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX scouting_writes_by_ip ON scouting_writes(ip_hash, at);

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('scouting', '{"open": false}');

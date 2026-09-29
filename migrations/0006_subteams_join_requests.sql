-- Subteams as a list admins edit (instead of typing the name on every
-- roster entry), and join requests from students.

CREATE TABLE subteams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  -- Private subteams (e.g. Drive Team) can't be picked on the join form;
  -- an admin assigns people to them. They still show on the public roster.
  private     INTEGER NOT NULL DEFAULT 0 CHECK (private IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO subteams (name, private, sort_order) VALUES
  ('Build', 0, 1),
  ('CAD', 0, 2),
  ('Programming', 0, 3),
  ('Electrical', 0, 4),
  ('Business', 0, 5),
  ('Media', 0, 6),
  ('Outreach', 0, 7),
  ('Scouting', 0, 8),
  ('Drive Team', 1, 9);

-- Keep any subteam names already typed on the roster.
INSERT OR IGNORE INTO subteams (name, sort_order)
  SELECT DISTINCT trim(subteam), 100 FROM roster_entries WHERE trim(subteam) <> '';

-- Each roster entry has one main subteam (shown publicly) ...
ALTER TABLE roster_entries ADD COLUMN subteam_id INTEGER REFERENCES subteams(id) ON DELETE SET NULL;
UPDATE roster_entries
SET subteam_id = (SELECT s.id FROM subteams s WHERE s.name = trim(roster_entries.subteam))
WHERE trim(subteam) <> '';
ALTER TABLE roster_entries DROP COLUMN subteam;

-- ... and can be on others too.
CREATE TABLE roster_extra_subteams (
  entry_id    INTEGER NOT NULL REFERENCES roster_entries(id) ON DELETE CASCADE,
  subteam_id  INTEGER NOT NULL REFERENCES subteams(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, subteam_id)
);

-- Students asking to join. Not shown on the public site; the form at /join
-- only works while an admin has it switched on (site_settings.join_requests).
CREATE TABLE join_requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  graduation_year     INTEGER NOT NULL,
  -- JSON array, most wanted first: [{"id": 3, "name": "Programming"}, …].
  -- Names are copied so the ranking still reads right if a subteam is renamed or deleted.
  ranking             TEXT NOT NULL DEFAULT '[]',
  about               TEXT NOT NULL DEFAULT '',
  -- pending | added | declined
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'added', 'declined')),
  -- The subteam an admin picked (starts as the first choice). Never shown to the student.
  assigned_subteam_id INTEGER REFERENCES subteams(id) ON DELETE SET NULL,
  person_id           INTEGER REFERENCES people(id) ON DELETE SET NULL,
  season_year         INTEGER,
  decided_by          TEXT,
  decided_at          TEXT,
  -- Hashed IP, only for rate limiting (like contact messages).
  ip_hash             TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX join_requests_by_status ON join_requests(status, created_at);

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('join_requests', '{"open": false}');

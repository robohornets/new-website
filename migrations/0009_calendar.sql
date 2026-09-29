-- The team's Google Calendar on the Team page.
-- site_settings.calendar.id is the calendar's ID (usually its Gmail address)
-- or a public iCal link. The calendar has to be public.

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('calendar', '{"id": "btwrobotics@gmail.com"}');

-- The last copy of the calendar feed, refreshed every few minutes and still
-- shown if Google can't be reached.
CREATE TABLE feed_cache (
  url         TEXT PRIMARY KEY,
  body        TEXT NOT NULL,
  fetched_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

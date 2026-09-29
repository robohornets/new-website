-- Outreach hours. Outreach events are ordinary season events with kind
-- 'outreach' (what we did goes in the event's recap). These columns hold
-- what only outreach needs:
--   outreach_hours: how long it ran, the starting hours for everyone logged
--   people_reached: rough head count of the public we talked to
ALTER TABLE events ADD COLUMN outreach_hours REAL;
ALTER TABLE events ADD COLUMN people_reached INTEGER;

-- Who went. Students and mentors both count. hours is NULL for "the whole
-- event" (the event's outreach_hours, so changing that updates them too).
CREATE TABLE outreach_attendance (
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  hours       REAL CHECK (hours IS NULL OR hours >= 0),
  PRIMARY KEY (event_id, person_id)
);
CREATE INDEX outreach_by_person ON outreach_attendance(person_id);

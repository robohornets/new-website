"use server";

import { redirect } from "next/navigation";
import { adminAction, bool, date, FormError, optionalInt, str, url, type ActionState } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { batch, first, run } from "@/lib/db";
import { seasonLabel } from "@/lib/format";
import { renderMarkdown } from "@/lib/markdown";

/** Hours as typed ("2", "1.5", "1:30"). Empty is null. */
function hours(fd: FormData, key: string, label: string): number | null {
  const raw = str(fd, key, 20);
  if (!raw) return null;
  const clock = /^(\d+):([0-5]\d)$/.exec(raw);
  const n = clock ? Number(clock[1]) + Number(clock[2]) / 60 : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 200) throw new FormError(`${label}: "${raw}" isn't a number of hours.`);
  return Math.round(n * 100) / 100;
}

function count(fd: FormData, key: string): number | null {
  const raw = str(fd, key, 20).replace(/[,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new FormError(`People reached should be a whole number, like 150.`);
  return n;
}

function eventFields(fd: FormData) {
  const name = str(fd, "name", 160);
  if (!name) throw new FormError("Give the event a name.");
  const start = date(fd, "start_date");
  const end = date(fd, "end_date");
  if (start && end && end < start) throw new FormError("The end date is before the start date.");
  return {
    name,
    start,
    end,
    location: str(fd, "location", 160),
    hours: hours(fd, "outreach_hours", "How long"),
    reached: count(fd, "people_reached"),
  };
}

export async function createOutreachEvent(year: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "event", entityId: year }, async () => {
    const f = eventFields(fd);
    const row = await first<{ id: number }>(
      `INSERT INTO events (season_year, name, kind, location, start_date, end_date, outreach_hours, people_reached)
       VALUES (?, ?, 'outreach', ?, ?, ?, ?, ?) RETURNING id`,
      year,
      f.name,
      f.location,
      f.start,
      f.end,
      f.hours,
      f.reached,
    );
    id = row?.id ?? 0;
  });
  if (result.ok && id) redirect(`/admin/impact/${id}?created=1`);
  return result;
}

/**
 * Everything on an impact event's page, saved together from the save bar:
 * its details, its story, who went. Its own photo album follows it (same
 * season and name, in the Gallery only while the event is on the site).
 */
export async function saveOutreachEvent(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "outreach", entityId: id }, async () => {
    const ev = await first<{ tba: string | null; tba_key: string | null; season_year: number; name: string; album_id: number | null }>(
      "SELECT tba, tba_key, season_year, name, album_id FROM events WHERE id = ? AND kind = 'outreach'",
      id,
    );
    if (!ev) throw new FormError("That impact event no longer exists.");
    // Events from The Blue Alliance stay in their key's season.
    const year = ev.tba_key ? ev.season_year : (optionalInt(fd, "season_year") ?? ev.season_year);
    if (year !== ev.season_year && !(await first("SELECT 1 FROM seasons WHERE year = ?", year))) throw new FormError("Pick a season that exists.");

    const went = [...new Set(fd.getAll("went").map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const statements: [string, ...(string | number | null)[]][] = [];
    // Events from The Blue Alliance keep TBA's name and dates (edit those on the event's page).
    if (!ev.tba) {
      const f = eventFields(fd);
      statements.push([
        "UPDATE events SET season_year = ?, name = ?, start_date = ?, end_date = ?, location = ?, outreach_hours = ?, people_reached = ?, recap = ? WHERE id = ?",
        year,
        f.name,
        f.start,
        f.end,
        f.location,
        f.hours,
        f.reached,
        str(fd, "recap", 4000),
        id,
      ]);
    } else {
      statements.push([
        "UPDATE events SET outreach_hours = ?, people_reached = ?, recap = ? WHERE id = ?",
        hours(fd, "outreach_hours", "How long"),
        count(fd, "people_reached"),
        str(fd, "recap", 4000),
        id,
      ]);
    }
    const hidden = bool(fd, "hidden");
    statements.push([
      "UPDATE events SET story = ?, story_published = ?, hidden = ?, highlight_video_url = ? WHERE id = ?",
      str(fd, "story", 100_000),
      bool(fd, "story_published"),
      hidden,
      url(fd, "highlight_video_url"),
      id,
    ]);
    if (ev.album_id) {
      const name = ev.tba ? ev.name : eventFields(fd).name;
      statements.push([
        "UPDATE albums SET season_year = ?, published = ?, title = CASE WHEN title = ? THEN ? ELSE title END WHERE id = ? AND slug = ?",
        year,
        hidden ? 0 : 1,
        ev.name,
        name,
        ev.album_id,
        `impact-${id}`,
      ]);
    }
    statements.push(["DELETE FROM outreach_attendance WHERE event_id = ?", id]);
    for (const person of went) {
      // Blank means the whole event.
      statements.push([
        "INSERT INTO outreach_attendance (event_id, person_id, hours) SELECT ?, id, ? FROM people WHERE id = ?",
        id,
        hours(fd, `hours_${person}`, "Hours"),
        person,
      ]);
    }
    await batch(statements);
    if (year !== ev.season_year) return `Moved to the ${seasonLabel(year)} season. ${went.length} ${went.length === 1 ? "person" : "people"} logged.`;
    return `Saved. ${went.length} ${went.length === 1 ? "person" : "people"} logged.`;
  });
}

export async function deleteOutreachEvent(id: number, _prev: ActionState): Promise<ActionState> {
  let year = 0;
  const result = await adminAction({ action: "delete", entity: "event", entityId: id }, async () => {
    const ev = await first<{ season_year: number; tba: string | null }>("SELECT season_year, tba FROM events WHERE id = ?", id);
    if (!ev) return;
    if (ev.tba) throw new FormError("This event comes from The Blue Alliance and would come back on the next sync. Tick “Hide this event from the site” instead.");
    year = ev.season_year;
    await run("DELETE FROM events WHERE id = ?", id);
  });
  if (result.ok) redirect(year ? `/admin/impact?season=${year}` : "/admin/impact");
  return result;
}

/**
 * The album an impact event's photos go into, made with the first upload
 * ("Demo at Central Library"), in the Gallery while the event is on the site.
 */
export async function ensureEventAlbum(id: number): Promise<number> {
  const user = await requireAdmin();
  const ev = await first<{ name: string; season_year: number; hidden: number; album_id: number | null }>(
    "SELECT name, season_year, hidden, album_id FROM events WHERE id = ?",
    id,
  );
  if (!ev) throw new Error("That event no longer exists.");
  if (ev.album_id) return ev.album_id;
  const album = await first<{ id: number }>(
    `INSERT INTO albums (slug, title, description, season_year, published, sort_order)
     VALUES (?, ?, '', ?, ?, (SELECT COALESCE(MIN(sort_order), 1) - 1 FROM albums))
     ON CONFLICT(slug) DO UPDATE SET slug = excluded.slug
     RETURNING id`,
    `impact-${id}`,
    ev.name,
    ev.season_year,
    ev.hidden ? 0 : 1,
  );
  if (!album) throw new Error("Couldn't make the event's album.");
  await run("UPDATE events SET album_id = ? WHERE id = ?", album.id, id);
  await run("INSERT INTO audit_log (actor, action, entity, entity_id) VALUES (?, 'create', 'album', ?)", user.email, String(album.id));
  return album.id;
}

/** Which album an impact event's photos come from: any album, or none. */
export async function setEventAlbum(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "event", entityId: id }, async () => {
    const albumId = optionalInt(fd, "album_id");
    if (albumId && !(await first("SELECT 1 FROM albums WHERE id = ?", albumId))) throw new FormError("That album no longer exists.");
    await run("UPDATE events SET album_id = ? WHERE id = ?", albumId, id);
    return albumId ? "The event's photos now come from that album." : "The event no longer has photos.";
  });
}

/**
 * Turns a post from the old News section into an impact event in the
 * current season (dated when it was published, hidden if it was a draft).
 */
export async function newsPostToImpact(postId: number, _prev: ActionState): Promise<ActionState> {
  let id = 0;
  const result = await adminAction({ action: "create", entity: "event", entityId: `post ${postId}` }, async () => {
    const post = await first<{ title: string; excerpt: string; body: string; published: number; day: string; season_year: number | null; album_id: number | null }>(
      "SELECT title, excerpt, body, published, date(COALESCE(published_at, created_at)) AS day, season_year, album_id FROM posts WHERE id = ? AND event_id IS NULL",
      postId,
    );
    if (!post) throw new FormError("That post was already moved.");
    const season = await first<{ year: number }>(
      "SELECT year FROM seasons WHERE year = ? UNION ALL SELECT year FROM (SELECT year FROM seasons ORDER BY is_current DESC, year DESC LIMIT 1)",
      post.season_year ?? 0,
    );
    if (!season) throw new FormError("Create a season first.");
    const row = await first<{ id: number }>(
      `INSERT INTO events (season_year, name, kind, start_date, recap, story, story_published, hidden, album_id)
       VALUES (?, ?, 'outreach', ?, ?, ?, ?, ?, ?) RETURNING id`,
      season.year,
      post.title,
      post.day,
      post.excerpt,
      post.body,
      post.published,
      post.published ? 0 : 1,
      post.album_id,
    );
    id = row?.id ?? 0;
    await run("UPDATE posts SET event_id = ?, category = 'outreach' WHERE id = ?", id, postId);
  });
  if (result.ok && id) redirect(`/admin/impact/${id}`);
  return result;
}

/** Renders Markdown for the story editor's preview tab. */
export async function previewMarkdown(source: string): Promise<string> {
  await requireAdmin();
  return renderMarkdown(source.slice(0, 100_000));
}

import "server-only";
import ICAL from "ical.js";
import { getEnv } from "./cf";
import { first, run } from "./db";

/** One occurrence on the calendar (a weekly meeting shows up once per week). */
export type CalendarItem = {
  key: string;
  title: string;
  allDay: boolean;
  /** All-day: YYYY-MM-DD. Timed: an ISO instant. */
  start: string;
  /** All-day: the last day (inclusive), YYYY-MM-DD. Timed: an ISO instant. */
  end: string;
  location: string;
  description: string;
};

export type CalendarLinks = { ics: string; webcal: string; google: string | null; view: string | null };

const MAX_AGE_SECONDS = 600;
/** How far ahead the saved list reaches; the page shows the next 60 days of it. */
const WINDOW_DAYS = 75;
const SHOW_DAYS = 60;

/**
 * The public iCal feed and the add/view links. Accepts a Google Calendar ID
 * (btwrobotics@gmail.com), Google's public iCal link for it, or any other
 * public iCal link.
 */
export function calendarLinks(input: string): CalendarLinks {
  const id = input.trim();
  const google = /^https:\/\/calendar\.google\.com\/calendar\/ical\/([^/]+)\/public\/basic\.ics/i.exec(id);
  const calendarId = google ? decodeURIComponent(google[1]) : /^https:\/\//i.test(id) ? null : id;
  if (!calendarId) return { ics: id, webcal: id.replace(/^https:/i, "webcal:"), google: null, view: null };
  const ics = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
  return {
    ics,
    webcal: ics.replace(/^https:/, "webcal:"),
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`,
    view: `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=America%2FChicago`,
  };
}

// ---- Cache ------------------------------------------------------------------------
// feed_cache holds the upcoming events already worked out (JSON), not the raw
// feed, so a page view never has to parse the calendar. Every query is
// guarded so a missing table (migration 0009 not applied) can't break the page.

type Saved = { items: CalendarItem[]; fetchedAt: string };

async function readSaved(url: string): Promise<Saved | null> {
  try {
    const row = await first<{ body: string; fetched_at: string }>("SELECT body, fetched_at FROM feed_cache WHERE url = ?", url);
    if (!row || !row.body.startsWith("[")) return null;
    return { items: JSON.parse(row.body) as CalendarItem[], fetchedAt: row.fetched_at };
  } catch (e) {
    console.error("calendar cache unavailable (has migration 0009 been applied?)", e);
    return null;
  }
}

async function writeSaved(url: string, items: CalendarItem[]) {
  try {
    await run(
      `INSERT INTO feed_cache (url, body, fetched_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(url) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
      url,
      JSON.stringify(items),
    );
  } catch {
    // No cache table: still works, just fetched every time.
  }
}

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { accept: "text/calendar" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    const body = res.ok ? await res.text() : "";
    if (body.includes("BEGIN:VCALENDAR")) return body;
    console.error(`calendar fetch failed: ${res.status} for ${url}${res.ok ? " (not an iCal feed; is the calendar public?)" : ""}`);
  } catch (e) {
    console.error("calendar fetch failed", e);
  }
  return null;
}

/** Only what's still to come, sorted, limited. */
function upcoming(items: CalendarItem[], limit: number): CalendarItem[] {
  const now = Date.now();
  const until = now + SHOW_DAYS * 86400000;
  const endOf = (i: CalendarItem) => (i.allDay ? Date.parse(`${i.end}T23:59:59-06:00`) : Date.parse(i.end));
  const startOf = (i: CalendarItem) => (i.allDay ? Date.parse(`${i.start}T00:00:00-06:00`) : Date.parse(i.start));
  return items.filter((i) => endOf(i) > now && startOf(i) <= until).slice(0, limit);
}

/**
 * Events in the next 60 days, soonest first, with repeating events expanded
 * (skipped and moved dates respected). Null when the calendar can't be
 * loaded. Never throws: the calendar is a nice-to-have, the Team page must
 * load either way.
 */
export async function getUpcomingCalendar(id: string, { limit = 50 }: { limit?: number } = {}): Promise<CalendarItem[] | null> {
  // Outside the try: Next marks the page as per-request by throwing here.
  await getEnv();
  try {
    const url = calendarLinks(id).ics;
    const saved = await readSaved(url);
    if (saved && (Date.now() - Date.parse(saved.fetchedAt)) / 1000 < MAX_AGE_SECONDS) return upcoming(saved.items, limit);

    const text = await fetchFeed(url);
    if (!text) return saved ? upcoming(saved.items, limit) : null;
    const items = expand(text);
    if (!items) return saved ? upcoming(saved.items, limit) : null;
    await writeSaved(url, items);
    return upcoming(items, limit);
  } catch (e) {
    console.error("calendar failed", e);
    return null;
  }
}

// ---- Parsing ------------------------------------------------------------------------

/**
 * Google's public feed has every event the calendar ever had. One-off events
 * that are over are dropped before parsing, which keeps the work (and the
 * Worker's CPU time) small. Repeating events are kept whatever their start.
 */
function dropPastOneOffs(text: string): string {
  const cutoff = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  return text.replace(/BEGIN:VEVENT[\s\S]*?END:VEVENT\r?\n?/g, (block) => {
    if (/\nRRULE[:;]/.test(block) || /\nRECURRENCE-ID[:;]/.test(block)) return block;
    const end = /\nDTEND[^:\n]*:(\d{8})/.exec(block)?.[1] ?? /\nDTSTART[^:\n]*:(\d{8})/.exec(block)?.[1];
    return end && end < cutoff ? "" : block;
  });
}

function plain(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .slice(0, 400);
}

const dateOnly = (t: ICAL.Time) => `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

/** Every occurrence from now until WINDOW_DAYS ahead. Null if the feed can't be read. */
export function expand(text: string): CalendarItem[] | null {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(dropPastOneOffs(text)));
  } catch (e) {
    console.error("calendar parse failed", e);
    return null;
  }
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);

  const masters = new Map<string, ICAL.Event>();
  const singles: ICAL.Event[] = [];
  const exceptions: ICAL.Event[] = [];
  for (const v of root.getAllSubcomponents("vevent")) {
    try {
      const e = new ICAL.Event(v);
      if (e.isRecurrenceException()) exceptions.push(e);
      else if (e.isRecurring()) masters.set(e.uid, e);
      else singles.push(e);
    } catch {
      // One odd event shouldn't hide the rest.
    }
  }
  for (const x of exceptions) {
    const master = masters.get(x.uid);
    try {
      if (master) master.relateException(x);
      else singles.push(x);
    } catch {
      singles.push(x);
    }
  }

  const now = ICAL.Time.fromJSDate(new Date(), true);
  const until = ICAL.Time.fromJSDate(new Date(Date.now() + WINDOW_DAYS * 86400000), true);
  const items: CalendarItem[] = [];

  const add = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time, key: string) => {
    if (String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return;
    if (end.compare(now) <= 0 || start.compare(until) > 0) return;
    const allDay = start.isDate;
    let endValue: string;
    if (allDay) {
      // iCal all-day ends are exclusive: an event on the 10th ends on the 11th.
      const last = end.clone();
      last.adjust(-1, 0, 0, 0);
      endValue = dateOnly(last.compare(start) < 0 ? start : last);
    } else endValue = end.toJSDate().toISOString();
    items.push({
      key,
      title: item.summary?.trim() || "Busy",
      allDay,
      start: allDay ? dateOnly(start) : start.toJSDate().toISOString(),
      end: endValue,
      location: (item.location ?? "").trim(),
      description: plain(item.description ?? ""),
    });
  };

  for (const e of singles) {
    try {
      add(e, e.startDate, e.endDate ?? e.startDate, `${e.uid}:${e.startDate.toString()}`);
    } catch {
      // skip
    }
  }
  for (const e of masters.values()) {
    try {
      const it = e.iterator();
      // Daily events from years ago can take a while to reach today; stop at the window.
      for (let i = 0, next = it.next(); next && i < 5000; i++, next = it.next()) {
        if (next.compare(until) > 0) break;
        const d = e.getOccurrenceDetails(next);
        add(d.item, d.startDate, d.endDate, `${e.uid}:${next.toString()}`);
      }
    } catch {
      // skip this series
    }
  }

  // All-day events sort at the start of their day in Tulsa (about 06:00 UTC).
  const sortKey = (i: CalendarItem) => (i.allDay ? `${i.start}T06:00:00.000Z` : i.start);
  return items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

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

/** The public iCal feed and the add/view links for a calendar ID or iCal URL. */
export function calendarLinks(id: string): CalendarLinks {
  if (/^https:\/\//i.test(id)) {
    return { ics: id, webcal: id.replace(/^https:/i, "webcal:"), google: null, view: null };
  }
  const ics = `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
  return {
    ics,
    webcal: ics.replace(/^https:/, "webcal:"),
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(id)}`,
    view: `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(id)}&ctz=America%2FChicago`,
  };
}

/** The feed text: a copy younger than a few minutes, else a fresh fetch, else the last copy we have. */
async function feed(url: string): Promise<string | null> {
  await getEnv();
  const row = await first<{ body: string; fetched_at: string }>("SELECT body, fetched_at FROM feed_cache WHERE url = ?", url);
  if (row && (Date.now() - Date.parse(row.fetched_at)) / 1000 < MAX_AGE_SECONDS) return row.body;
  try {
    const res = await fetch(url, { headers: { accept: "text/calendar" }, signal: AbortSignal.timeout(8000) });
    const body = res.ok ? await res.text() : "";
    if (!body.includes("BEGIN:VCALENDAR")) return row?.body ?? null;
    await run(
      `INSERT INTO feed_cache (url, body, fetched_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(url) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at`,
      url,
      body,
    );
    return body;
  } catch {
    return row?.body ?? null;
  }
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

/**
 * Events between now and `days` from now, soonest first, with repeating
 * events expanded (and their skipped or moved dates respected). Null when
 * the calendar can't be loaded at all.
 */
export async function getUpcomingCalendar(id: string, { days = 60, limit = 50 } = {}): Promise<CalendarItem[] | null> {
  const text = await feed(calendarLinks(id).ics);
  if (!text) return null;

  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    return null;
  }
  for (const tz of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);

  const masters = new Map<string, ICAL.Event>();
  const singles: ICAL.Event[] = [];
  const exceptions: ICAL.Event[] = [];
  for (const v of root.getAllSubcomponents("vevent")) {
    const e = new ICAL.Event(v);
    if (e.isRecurrenceException()) exceptions.push(e);
    else if (e.isRecurring()) masters.set(e.uid, e);
    else singles.push(e);
  }
  for (const x of exceptions) {
    const master = masters.get(x.uid);
    if (master) master.relateException(x);
    else singles.push(x);
  }

  const now = ICAL.Time.fromJSDate(new Date(), true);
  const until = ICAL.Time.fromJSDate(new Date(Date.now() + days * 86400000), true);
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
    const end = e.endDate ?? e.startDate;
    add(e, e.startDate, end, `${e.uid}:${e.startDate.toString()}`);
  }
  for (const e of masters.values()) {
    const it = e.iterator();
    for (let i = 0, next = it.next(); next && i < 2000; i++, next = it.next()) {
      if (next.compare(until) > 0) break;
      const d = e.getOccurrenceDetails(next);
      add(d.item, d.startDate, d.endDate, `${e.uid}:${next.toString()}`);
    }
  }

  // All-day events sort at the start of their day in Tulsa (about 06:00 UTC).
  const sortKey = (i: CalendarItem) => (i.allDay ? `${i.start}T06:00:00.000Z` : i.start);
  return items.sort((a, b) => sortKey(a).localeCompare(sortKey(b))).slice(0, limit);
}

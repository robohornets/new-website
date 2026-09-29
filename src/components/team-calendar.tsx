import type { CalendarItem, CalendarLinks } from "@/lib/calendar";
import { External } from "./icons";
import { ShowMore } from "./show-more";

const TZ = "America/Chicago";

// All-day dates are plain calendar days; format them in UTC so they don't shift.
const dayOf = (item: CalendarItem) => (item.allDay ? new Date(`${item.start}T12:00:00Z`) : new Date(item.start));
const zoneFor = (item: CalendarItem) => (item.allDay ? "UTC" : TZ);

function fmt(d: Date, zone: string, opts: Intl.DateTimeFormatOptions) {
  return d.toLocaleString("en-US", { timeZone: zone, ...opts });
}

function timeText(item: CalendarItem): string {
  if (item.allDay) {
    if (item.end === item.start) return "All day";
    const end = new Date(`${item.end}T12:00:00Z`);
    return `All day, through ${fmt(end, "UTC", { weekday: "short", month: "short", day: "numeric" })}`;
  }
  const start = new Date(item.start);
  const end = new Date(item.end);
  const t = (d: Date) => fmt(d, TZ, { hour: "numeric", minute: "2-digit" }).replace(":00", "");
  const sameDay = fmt(start, TZ, { dateStyle: "short" }) === fmt(end, TZ, { dateStyle: "short" });
  if (!sameDay) return `${t(start)} – ${fmt(end, TZ, { month: "short", day: "numeric" })}, ${t(end)}`;
  // "3:30 – 6 PM" rather than "3:30 PM – 6 PM" when both are PM (or both AM).
  const [a, b] = [t(start), t(end)];
  const suffix = (x: string) => x.slice(-2);
  return suffix(a) === suffix(b) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/** Upcoming events from the team's Google Calendar, grouped by month. */
export function TeamCalendar({ items, links }: { items: CalendarItem[] | null; links: CalendarLinks }) {
  const monthOf = (i: CalendarItem) => fmt(dayOf(i), zoneFor(i), { month: "long", year: "numeric" });

  const rows = (items ?? []).map((item, index, all) => {
    const d = dayOf(item);
    const zone = zoneFor(item);
    const month = monthOf(item);
    const newMonth = index === 0 || monthOf(all[index - 1]) !== month;
    return (
      <li key={item.key} className="flex flex-col gap-3">
        {newMonth && <h3 className={`eyebrow text-ash ${index === 0 ? "" : "pt-4"}`}>{month}</h3>}
        <div className="flex gap-4 rounded-md border border-line bg-panel p-4">
          <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-md bg-raise py-2" aria-hidden="true">
            <span className="font-label text-[11px] font-bold tracking-wider text-hornet uppercase">{fmt(d, zone, { weekday: "short" })}</span>
            <span className="font-display text-3xl leading-none font-extrabold">{fmt(d, zone, { day: "numeric" })}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="sr-only">{fmt(d, zone, { weekday: "long", month: "long", day: "numeric" })}</span>
            <span className="font-semibold">{item.title}</span>
            <span className="text-sm text-sand">
              {timeText(item)}
              {item.location && (
                <>
                  {" · "}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-bone hover:underline"
                  >
                    {item.location}
                  </a>
                </>
              )}
            </span>
            {item.description && <p className="line-clamp-2 text-sm whitespace-pre-line text-dust">{item.description}</p>}
          </div>
        </div>
      </li>
    );
  });

  return (
    <div className="flex flex-col gap-6">
      {items === null ? (
        <p className="rounded-md border border-dashed border-edge p-6 text-sm text-dust">
          The calendar couldn&apos;t be loaded right now.{" "}
          {links.view && (
            <a href={links.view} target="_blank" rel="noopener noreferrer" className="font-semibold text-hornet hover:text-hornet-hover">
              Open it in Google Calendar
            </a>
          )}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-6 text-sm text-dust">Nothing on the calendar for the next two months.</p>
      ) : (
        <ShowMore items={rows} initial={6} noun="events" className="flex flex-col gap-3" />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {links.google && (
          <a
            href={links.google}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone"
          >
            Add to Google Calendar <External size={14} />
          </a>
        )}
        <a href={links.webcal} className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
          Subscribe (Apple, Outlook)
        </a>
        {links.view && (
          <a href={links.view} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-2 px-2 text-sm font-semibold text-hornet hover:text-hornet-hover">
            Full calendar <External size={14} />
          </a>
        )}
      </div>
    </div>
  );
}

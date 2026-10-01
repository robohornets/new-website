import Link from "next/link";
import { formatDate, impactPath } from "@/lib/format";
import type { PublicOutreachEvent } from "@/lib/outreach";
import { ArrowRight } from "./icons";
import { MediaImage } from "./media-image";

/** "March 3, 2026", or a range for events over several days. */
export function impactWhen(e: Pick<PublicOutreachEvent, "start_date" | "end_date">) {
  if (!e.start_date) return "Date to be announced";
  const start = formatDate(e.start_date, { month: "long", day: "numeric", year: "numeric" });
  if (!e.end_date || e.end_date.slice(0, 10) === e.start_date.slice(0, 10)) return start;
  return `${formatDate(e.start_date, { month: "long", day: "numeric" })} – ${formatDate(e.end_date, { month: "long", day: "numeric", year: "numeric" })}`;
}

/** An impact event on the Impact page, the homepage and its season's page. Ones with a story say so. */
export function ImpactCard({ event: e }: { event: PublicOutreachEvent }) {
  return (
    <Link href={impactPath(e)} className="group flex h-full flex-col overflow-hidden rounded-md border border-line bg-panel hover:border-edge">
      {e.cover_key && <MediaImage mediaKey={e.cover_key} alt="" className="h-52 w-full" maxWidth={960} />}
      <div className="flex grow flex-col gap-2 p-5">
        <span className="font-label text-xs tracking-wider text-dust uppercase">{impactWhen(e)}</span>
        <h3 className="font-display text-2xl leading-tight font-bold uppercase group-hover:text-hornet">{e.name}</h3>
        {e.location && <span className="text-sm text-dust">{e.location}</span>}
        {e.recap && <p className="line-clamp-4 text-[15px] leading-relaxed whitespace-pre-line text-sand">{e.recap}</p>}
        {e.has_story === 1 && (
          <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-semibold text-hornet">
            Read the story <ArrowRight size={14} />
          </span>
        )}
      </div>
    </Link>
  );
}

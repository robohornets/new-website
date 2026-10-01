import type { OutreachTotals } from "@/lib/outreach";
import { seasonLabel } from "@/lib/format";

/** The season's outreach in three numbers. Only totals: nobody's own hours. */
export function OutreachTotalsStrip({ totals }: { totals: OutreachTotals }) {
  const stats = [
    { label: "volunteer hours", value: Math.round(totals.hours) },
    { label: totals.events === 1 ? "outreach event" : "outreach events", value: totals.events },
    { label: "people reached", value: totals.reached },
  ].filter((s) => s.value > 0);
  if (stats.length === 0) return null;
  return (
    <section aria-label={`Outreach in the ${seasonLabel(totals.year)} season`} className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 pt-6 md:px-8 md:pt-8 xl:px-16">
        <span className="eyebrow text-[11px] text-ash">{seasonLabel(totals.year)} season so far</span>
      </div>
      <dl className={`mx-auto grid max-w-[1440px] md:px-8 xl:px-16 ${["", "grid-cols-1", "grid-cols-2", "grid-cols-3"][stats.length]}`}>
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex min-w-0 flex-col-reverse justify-center gap-1.5 border-line px-4 pt-3 pb-6 not-last:border-r md:pb-8 md:first:pl-0 lg:px-10"
          >
            <dt className="text-[13px] text-dust md:text-[15px]">{s.label}</dt>
            <dd className="font-display text-[34px] leading-none font-extrabold tabular-nums sm:text-[44px] md:text-[64px]">{s.value.toLocaleString("en-US")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

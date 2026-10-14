import Link from "next/link";
import type { SponsorTier } from "@/lib/types";
import { Check } from "./icons";

/** The contact form, opened on "Sponsoring the team" with this level in the message. */
function askHref(level: SponsorTier) {
  return `/contact?topic=sponsorship&level=${encodeURIComponent(level.name)}`;
}

/**
 * Every benefit any level lists, as table rows: the ones most levels share
 * first, so the checkmarks step down from the top level.
 */
function benefitRows(levels: SponsorTier[]) {
  const rows: { key: string; label: string; count: number }[] = [];
  for (const level of levels) {
    for (const b of level.benefits) {
      const key = b.label.toLowerCase();
      const row = rows.find((r) => r.key === key);
      if (row) row.count++;
      else rows.push({ key, label: b.label, count: 1 });
    }
  }
  // Stable sort: ties keep the order the levels list them in.
  return rows.sort((a, b) => b.count - a.count);
}

/** Name, amount and the lines under it, at the top of a column or card. */
function LevelSummary({ level, compact }: { level: SponsorTier; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`font-display leading-none font-extrabold uppercase ${compact ? "text-[26px] xl:text-[28px]" : "text-[34px]"}`}>
        {level.name}
      </span>
      <span className={`font-display leading-none font-black text-hornet ${compact ? "text-[34px] xl:text-[40px]" : "text-[52px]"}`}>
        {level.amount}
      </span>
      {level.amount_note && <span className="text-sm leading-snug whitespace-pre-line text-sand">{level.amount_note}</span>}
    </div>
  );
}

function AskLink({ level, top, className = "" }: { level: SponsorTier; top: boolean; className?: string }) {
  return (
    <Link
      href={askHref(level)}
      className={`flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-center text-sm font-bold ${
        top ? "bg-hornet text-ink hover:bg-hornet-hover" : "border-[1.5px] border-edge text-bone hover:border-bone"
      } ${className}`}
    >
      Ask about {level.name}
    </Link>
  );
}

/** A labelled band across the table, starting a group of rows. */
function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <th colSpan={span} scope="rowgroup" className="border-b border-line bg-panel px-6 py-3.5 text-left">
        <span className="eyebrow text-hornet">{label}</span>
      </th>
    </tr>
  );
}

/**
 * The sponsorship levels side by side: a table on wide screens, one card per
 * level on phones and tablets. The top level is picked out in orange.
 */
export function SponsorLevels({ levels }: { levels: SponsorTier[] }) {
  if (levels.length === 0) return null;
  const rows = benefitRows(levels);
  const hasProvides = levels.some((l) => l.provides.length > 0);
  // The top level's column is tinted all the way down.
  const tint = (i: number) => (i === 0 ? "bg-hornet/6" : "");

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-line-strong bg-ink lg:block">
        <table className="w-full table-fixed border-collapse text-[15px] leading-snug">
          <caption className="sr-only">Sponsorship levels compared</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] border-b border-line-strong px-6 py-7 text-left align-bottom">
                <span className="eyebrow text-ash">Level</span>
              </th>
              {levels.map((l, i) => (
                <th
                  key={l.id}
                  scope="col"
                  className={`border-t-[3px] border-b border-b-line-strong px-5 py-7 text-left align-top font-normal ${
                    i === 0 ? "border-t-hornet" : "border-t-transparent"
                  } ${tint(i)}`}
                >
                  <LevelSummary level={l} compact />
                </th>
              ))}
            </tr>
          </thead>
          {hasProvides && (
            <tbody>
              <GroupRow label="Your gift pays for" span={levels.length + 1} />
              <tr>
                <th scope="row" className="border-b border-line px-6 py-5 text-left align-top font-semibold text-dust">
                  Where it goes
                </th>
                {levels.map((l, i) => (
                  <td key={l.id} className={`border-b border-line px-5 py-5 align-top text-sand ${tint(i)}`}>
                    <ul className="flex flex-col gap-2">
                      {l.provides.map((p, j) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          )}
          {rows.length > 0 && (
            <tbody>
              <GroupRow label="How we thank you" span={levels.length + 1} />
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="border-b border-line px-6 py-4 text-left font-semibold">
                    {row.label}
                  </th>
                  {levels.map((l, i) => {
                    const b = l.benefits.find((x) => x.label.toLowerCase() === row.key);
                    return (
                      <td key={l.id} className={`border-b border-line px-5 py-4 ${tint(i)}`}>
                        {b ? (
                          <span className="flex items-center gap-2 text-sand">
                            <Check size={20} className="shrink-0 text-hornet" />
                            <span className="sr-only">Included</span>
                            {b.value}
                          </span>
                        ) : (
                          <>
                            <span aria-hidden="true" className="block h-0.5 w-3.5 bg-edge" />
                            <span className="sr-only">Not included</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          )}
          <tfoot>
            <tr>
              <td className="px-6 py-5" />
              {levels.map((l, i) => (
                <td key={l.id} className={`px-5 py-5 ${tint(i)}`}>
                  <AskLink level={l} top={i === 0} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {levels.map((l, i) => (
          <li
            key={l.id}
            className={`flex flex-col gap-5 rounded-lg border-[1.5px] bg-raise p-6 ${i === 0 ? "border-hornet" : "border-line-strong"}`}
          >
            <LevelSummary level={l} />
            {l.provides.length > 0 && (
              <div className="flex flex-col gap-2.5 border-t border-line-strong pt-5">
                <h3 className="eyebrow text-dust">Pays for</h3>
                <ul className="flex flex-col gap-2 text-[15px] leading-snug text-sand">
                  {l.provides.map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {l.benefits.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <h3 className="eyebrow text-dust">You get</h3>
                <ul className="flex flex-col gap-2 text-[15px] leading-snug">
                  {l.benefits.map((b, j) => (
                    <li key={j} className="flex gap-2.5">
                      <Check size={18} className="mt-px shrink-0 text-hornet" />
                      <span>
                        {b.label}
                        {b.value && <span className="text-dust"> · {b.value}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <AskLink level={l} top={i === 0} className="mt-auto" />
          </li>
        ))}
      </ul>
    </>
  );
}

import { mediaUrl } from "@/lib/media";
import type { SeasonSponsor } from "@/lib/types";

/** Sponsors grouped by tier: the top tier gets big tiles, the rest a logo grid. */
export function SponsorWall({ sponsors, showEmpty = true }: { sponsors: SeasonSponsor[]; showEmpty?: boolean }) {
  if (sponsors.length === 0) {
    return showEmpty ? (
      <p className="rounded-md border-[1.5px] border-dashed border-edge p-8 text-center text-dust">
        Your company could be the first logo here.
      </p>
    ) : null;
  }

  const tiers: { name: string; rank: number; sponsors: SeasonSponsor[] }[] = [];
  for (const s of sponsors) {
    let tier = tiers.find((t) => t.name === s.tier_name);
    if (!tier) {
      tier = { name: s.tier_name, rank: s.tier_rank, sponsors: [] };
      tiers.push(tier);
    }
    tier.sponsors.push(s);
  }
  tiers.sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col gap-10">
      {tiers.map((tier, i) => (
        <div key={tier.name} className="flex flex-col gap-3.5">
          <h3 className={`eyebrow text-xs ${i === 0 ? "text-hornet" : "text-sand"}`}>{tier.name}</h3>
          <ul
            className={
              i === 0
                ? "grid gap-4 sm:grid-cols-2"
                : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6"
            }
          >
            {tier.sponsors.map((s) => (
              <li key={s.id}>
                <SponsorTile sponsor={s} large={i === 0} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SponsorTile({ sponsor, large }: { sponsor: SeasonSponsor; large: boolean }) {
  const logo = mediaUrl(sponsor.logo_key, large ? 640 : 320);
  const inner = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt={sponsor.name}
      loading="lazy"
      className={`max-w-[80%] object-contain ${large ? "max-h-24" : "max-h-14"}`}
    />
  ) : (
    <span
      className={`px-4 text-center font-display font-extrabold tracking-wide uppercase ${
        large ? "text-3xl md:text-4xl" : "text-lg"
      }`}
    >
      {sponsor.name}
    </span>
  );
  const className = `flex items-center justify-center rounded-md bg-bone text-ink transition-transform hover:-translate-y-0.5 ${
    large ? "h-36" : "h-22"
  }`;
  return sponsor.url ? (
    <a href={sponsor.url} target="_blank" rel="noopener noreferrer" className={className} title={sponsor.name}>
      {inner}
    </a>
  ) : (
    <div className={className} title={sponsor.name}>
      {inner}
    </div>
  );
}

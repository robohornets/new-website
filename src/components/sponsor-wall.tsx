import { mediaUrl } from "@/lib/media";
import type { SeasonSponsor, SponsorLogoSize } from "@/lib/types";

type LogoSize = Exclude<SponsorLogoSize, "name">;

/** Each tier picks its size in the admin: higher levels get bigger tiles. */
const SIZES: Record<LogoSize, { grid: string; tile: string; img: string; text: string; width: number }> = {
  large: { grid: "grid gap-4 sm:grid-cols-2", tile: "h-36", img: "max-h-24", text: "text-3xl md:text-4xl", width: 640 },
  medium: { grid: "grid grid-cols-2 gap-4 lg:grid-cols-4", tile: "h-28", img: "max-h-18", text: "text-xl md:text-2xl", width: 480 },
  small: { grid: "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6", tile: "h-22", img: "max-h-14", text: "text-lg", width: 320 },
};

/** Sponsors grouped by tier, as logo tiles sized by tier or (for "name") a list of names. */
export function SponsorWall({ sponsors, showEmpty = true }: { sponsors: SeasonSponsor[]; showEmpty?: boolean }) {
  if (sponsors.length === 0) {
    return showEmpty ? (
      <p className="rounded-md border-[1.5px] border-dashed border-edge p-8 text-center text-dust">
        Your company could be the first logo here.
      </p>
    ) : null;
  }

  const tiers: { id: number; name: string; rank: number; size: SponsorLogoSize; sponsors: SeasonSponsor[] }[] = [];
  for (const s of sponsors) {
    let tier = tiers.find((t) => t.id === s.tier_id);
    if (!tier) {
      tier = { id: s.tier_id, name: s.tier_name, rank: s.tier_rank, size: s.tier_logo_size, sponsors: [] };
      tiers.push(tier);
    }
    tier.sponsors.push(s);
  }
  tiers.sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col gap-10">
      {tiers.map((tier, i) => (
        <div key={tier.id} className="flex flex-col gap-3.5">
          <h3 className={`eyebrow text-xs ${i === 0 ? "text-hornet" : "text-sand"}`}>{tier.name}</h3>
          <TierSponsors size={tier.size} sponsors={tier.sponsors} />
        </div>
      ))}
    </div>
  );
}

function TierSponsors({ size, sponsors }: { size: SponsorLogoSize; sponsors: SeasonSponsor[] }) {
  if (size === "name") {
    return (
      <ul className="flex flex-wrap gap-x-8 gap-y-2 text-lg font-semibold">
        {sponsors.map((s) => (
          <li key={s.id}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-hornet">
                {s.name}
              </a>
            ) : (
              s.name
            )}
          </li>
        ))}
      </ul>
    );
  }
  const look = SIZES[size];
  return (
    <ul className={look.grid}>
      {sponsors.map((s) => (
        <li key={s.id}>
          <SponsorTile sponsor={s} look={look} />
        </li>
      ))}
    </ul>
  );
}

function SponsorTile({ sponsor, look }: { sponsor: SeasonSponsor; look: (typeof SIZES)[LogoSize] }) {
  const logo = mediaUrl(sponsor.logo_key, look.width);
  const inner = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt={sponsor.name} loading="lazy" className={`max-w-[80%] object-contain ${look.img}`} />
  ) : (
    <span className={`px-4 text-center font-display font-extrabold tracking-wide uppercase ${look.text}`}>{sponsor.name}</span>
  );
  const className = `flex items-center justify-center rounded-md bg-bone text-ink transition-transform hover:-translate-y-0.5 ${look.tile}`;
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

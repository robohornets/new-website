import Link from "next/link";

/** Links that switch the ?season= of the current admin page. */
export function SeasonPicker({ basePath, years, current }: { basePath: string; years: number[]; current: number | null }) {
  if (years.length === 0) return null;
  return (
    <nav aria-label="Season" className="flex flex-wrap items-center gap-1.5">
      <span className="eyebrow mr-2 text-[11px] text-ash">Season</span>
      {years.map((y) => (
        <Link
          key={y}
          href={`${basePath}?season=${y}`}
          aria-current={y === current ? "page" : undefined}
          className={`flex h-9 items-center rounded-md px-3 font-label text-sm ${
            y === current ? "bg-hornet font-bold text-ink" : "text-sand hover:bg-raise"
          }`}
        >
          {y}
        </Link>
      ))}
    </nav>
  );
}

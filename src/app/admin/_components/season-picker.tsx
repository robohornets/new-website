import { SeasonSwitcher } from "@/components/season-switcher";

/** Switches the ?season= of the current admin page: the newest few years, then "Older seasons". */
export function SeasonPicker({ basePath, years, current }: { basePath: string; years: number[]; current: number | null }) {
  if (years.length === 0) return null;
  return (
    <nav aria-label="Season">
      <SeasonSwitcher years={years} current={current} href={`${basePath}?season={year}`} label="Season" />
    </nav>
  );
}

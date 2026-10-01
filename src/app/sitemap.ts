import type { MetadataRoute } from "next";
import { all } from "@/lib/db";

const BASE = "https://btwrobotics.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [seasons, albums, events] = await Promise.all([
    all<{ year: number; updated_at: string }>("SELECT year, updated_at FROM seasons"),
    all<{ slug: string }>("SELECT slug FROM albums WHERE published = 1"),
    all<{ id: number; season_year: number }>("SELECT id, season_year FROM events WHERE hidden = 0"),
  ]);
  const pages = ["", "/team", "/seasons", "/impact", "/gallery", "/sponsors", "/contact"];
  return [
    ...pages.map((p) => ({ url: `${BASE}${p}` })),
    ...seasons.map((s) => ({ url: `${BASE}/seasons/${s.year}`, lastModified: s.updated_at })),
    ...albums.map((a) => ({ url: `${BASE}/gallery/${a.slug}` })),
    ...events.map((e) => ({ url: `${BASE}/seasons/${e.season_year}/events/${e.id}` })),
  ];
}

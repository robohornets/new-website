import type { MetadataRoute } from "next";
import { all } from "@/lib/db";

const BASE = "https://btwrobotics.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [seasons, posts, albums] = await Promise.all([
    all<{ year: number; updated_at: string }>("SELECT year, updated_at FROM seasons"),
    all<{ slug: string; updated_at: string }>("SELECT slug, updated_at FROM posts WHERE published = 1"),
    all<{ slug: string }>("SELECT slug FROM albums WHERE published = 1"),
  ]);
  const pages = ["", "/team", "/seasons", "/news", "/outreach", "/gallery", "/sponsors", "/contact"];
  return [
    ...pages.map((p) => ({ url: `${BASE}${p}` })),
    ...seasons.map((s) => ({ url: `${BASE}/seasons/${s.year}`, lastModified: s.updated_at })),
    ...posts.map((p) => ({ url: `${BASE}/news/${p.slug}`, lastModified: p.updated_at })),
    ...albums.map((a) => ({ url: `${BASE}/gallery/${a.slug}` })),
  ];
}

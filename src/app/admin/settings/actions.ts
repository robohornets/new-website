"use server";

import { adminAction, bool, FormError, int, optionalInt, parsePairs, str, url, type ActionState } from "@/lib/admin";
import { run } from "@/lib/db";
import type { SiteSettings, Social, SocialPlatform } from "@/lib/types";

const PLATFORMS: SocialPlatform[] = ["youtube", "instagram", "tiktok", "x", "github", "facebook", "threads"];

type Section = keyof SiteSettings;

function build(section: Section, fd: FormData): unknown {
  switch (section) {
    case "hero":
      return {
        eyebrow: str(fd, "eyebrow", 120),
        titleTop: str(fd, "titleTop", 20) || "Robo",
        titleBottom: str(fd, "titleBottom", 20) || "Hornets",
        intro: str(fd, "intro", 600),
      };
    case "stats":
      return parsePairs(str(fd, "stats", 2000))
        .slice(0, 4)
        .map(([value, label]) => ({ value, label }));
    case "about":
      return { heading: str(fd, "heading", 160), body: str(fd, "body", 800), long: str(fd, "long", 6000) };
    case "build_steps": {
      const steps = [];
      for (let i = 0; i < 4; i++) {
        const title = str(fd, `title_${i}`, 60);
        if (title) steps.push({ title, when: str(fd, `when_${i}`, 30), body: str(fd, `body_${i}`, 400) });
      }
      return steps;
    }
    case "join":
      return { heading: str(fd, "heading", 80) || "Join the hive", body: str(fd, "body", 800) };
    case "contact": {
      const email = str(fd, "email", 200);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new FormError("That email address doesn't look right.");
      return { email, address: str(fd, "address", 300), mapsUrl: url(fd, "mapsUrl") ?? "", intro: str(fd, "intro", 400) };
    }
    case "socials": {
      const socials: Social[] = [];
      for (const platform of PLATFORMS) {
        const link = url(fd, platform);
        if (link) socials.push({ platform, url: link });
      }
      return socials;
    }
    case "friend_links":
      return parsePairs(str(fd, "links", 3000)).map(([label, link]) => {
        if (!/^https?:\/\//i.test(link)) throw new FormError(`The link for "${label}" needs to start with https://`);
        return { label, url: link };
      });
    case "donate_url":
      return url(fd, "donate_url") ?? "";
    case "mission":
      return str(fd, "mission", 800);
    case "values": {
      const values = [];
      for (let i = 0; i < 8; i++) {
        const title = str(fd, `title_${i}`, 40);
        if (title) values.push({ title, body: str(fd, `body_${i}`, 200) });
      }
      return values;
    }
    case "strategic_plan":
      return {
        summary: str(fd, "summary", 1200),
        media_id: optionalInt(fd, "plan_media_id"),
        url: url(fd, "plan_url") ?? "",
        updated: str(fd, "updated", 40),
      };
    case "join_requests":
      return { open: bool(fd, "open") === 1 };
    case "scouting":
      return { open: bool(fd, "open") === 1 };
  }
}

export async function saveSettings(section: Section, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "site_settings", entityId: section }, async () => {
    const value = JSON.stringify(build(section, fd));
    await run(
      `INSERT INTO site_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
      section,
      value,
    );
  });
}

function contactFields(fd: FormData) {
  const name = str(fd, "name", 120);
  if (!name) throw new FormError("Name is required.");
  return [name, str(fd, "role", 160), str(fd, "email", 200), int(fd, "sort_order", 0)] as const;
}

export async function createContact(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "create", entity: "contact" }, async () => {
    await run("INSERT INTO contacts (name, role, email, sort_order) VALUES (?, ?, ?, ?)", ...contactFields(fd));
    return "Contact added.";
  });
}

export async function updateContact(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction({ action: "update", entity: "contact", entityId: id }, async () => {
    await run("UPDATE contacts SET name = ?, role = ?, email = ?, sort_order = ? WHERE id = ?", ...contactFields(fd), id);
  });
}

export async function deleteContact(id: number, _prev: ActionState): Promise<ActionState> {
  return adminAction({ action: "delete", entity: "contact", entityId: id }, async () => {
    await run("DELETE FROM contacts WHERE id = ?", id);
    return "Contact removed.";
  });
}

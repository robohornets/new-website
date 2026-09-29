"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Close, Menu } from "@/components/icons";

const GROUPS = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard" }, { href: "/admin/messages", label: "Messages", badge: "messages" }] },
  {
    label: "Seasons",
    items: [
      { href: "/admin/seasons", label: "Seasons, robots & events" },
      { href: "/admin/roster", label: "Team roster" },
      { href: "/admin/join", label: "Join requests", badge: "join" },
      { href: "/admin/scouting", label: "Scouting" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/posts", label: "News & outreach" },
      { href: "/admin/gallery", label: "Gallery" },
      { href: "/admin/sponsors", label: "Sponsors" },
      { href: "/admin/settings", label: "Site text & links" },
    ],
  },
  {
    label: "Files",
    items: [
      { href: "/admin/media", label: "Media library" },
      { href: "/admin/export", label: "Export & backup" },
    ],
  },
] as const;

function active(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({ email, badges }: { email: string; badges: { messages: number; join: number } }) {
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  const nav = (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          <span className="eyebrow px-3 pb-1.5 text-[11px] text-ash">{g.label}</span>
          {g.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(pathname, item.href) ? "page" : undefined}
              className={`flex h-10 items-center justify-between rounded-md px-3 text-sm font-medium ${
                active(pathname, item.href) ? "bg-raise text-bone" : "text-dust hover:bg-raise/60 hover:text-bone"
              }`}
            >
              {item.label}
              {"badge" in item && badges[item.badge] > 0 && <span className="font-label text-xs text-hornet">{badges[item.badge]}</span>}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-line bg-ink-deep px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpenFor(open ? null : pathname)}
          aria-expanded={open}
          aria-label={open ? "Close admin menu" : "Open admin menu"}
          className="flex size-11 items-center justify-center rounded-md border border-line-strong"
        >
          {open ? <Close /> : <Menu />}
        </button>
      </div>
      {open && <div className="border-b border-line bg-ink-deep px-4 py-5 lg:hidden">{nav}</div>}
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col gap-7 overflow-y-auto border-r border-line bg-ink-deep px-4 py-6 lg:flex">
        <Brand />
        {nav}
        <div className="mt-auto flex flex-col gap-1 rounded-md border border-line bg-panel px-3 py-3.5">
          <span className="text-xs text-ash">Signed in with Cloudflare Access</span>
          <span className="truncate text-[13px] font-semibold" title={email}>
            {email}
          </span>
          <a href="/cdn-cgi/access/logout" className="text-xs text-hornet hover:text-hornet-hover">
            Sign out
          </a>
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-3 px-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/hornet.svg" alt="" width={425} height={599} className="h-11 w-auto" />
      <span className="flex flex-col">
        <span className="font-display text-xl font-extrabold tracking-wide">1209 ADMIN</span>
        <span className="text-xs text-ash">btwrobotics.com</span>
      </span>
    </Link>
  );
}

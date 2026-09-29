"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Close, Menu } from "./icons";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/team", label: "Team" },
  { href: "/seasons", label: "Seasons" },
  { href: "/news", label: "News" },
  { href: "/outreach", label: "Outreach" },
  { href: "/gallery", label: "Gallery" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 text-bone" aria-label="RoboHornets home">
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bone md:size-13">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/robohornet.png" alt="" className="size-10 object-contain md:size-12" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-display text-[22px] leading-none font-extrabold tracking-wide md:text-[26px]">
          ROBOHORNETS
        </span>
        {!compact && <span className="font-mono text-xs tracking-wider text-dust">FRC TEAM 1209</span>}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  // Closing on navigation: the menu is only open for the path it was opened on.
  const open = openFor === pathname;

  return (
    <header className="relative z-30 border-b border-line bg-ink">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 md:h-[88px] md:px-8 xl:px-16">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-7 text-[15px] font-medium lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className={isActive(pathname, item.href) ? "text-bone" : "text-dust hover:text-bone"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/sponsors#support"
            className="hidden h-11 items-center rounded-md bg-hornet px-5 text-[15px] font-bold text-ink hover:bg-amber sm:flex"
          >
            Support the team
          </Link>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-md border border-line-strong text-bone lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpenFor(open ? null : pathname)}
          >
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="absolute inset-x-0 top-full border-b border-line bg-ink px-4 pt-2 pb-6 lg:hidden"
        >
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={`flex h-12 items-center border-b border-line font-display text-2xl font-bold uppercase ${
                    isActive(pathname, item.href) ? "text-hornet" : "text-bone"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/sponsors#support"
            className="mt-5 flex h-12 items-center justify-center rounded-md bg-hornet font-bold text-ink"
          >
            Support the team
          </Link>
        </nav>
      )}
    </header>
  );
}

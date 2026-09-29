import Link from "next/link";
import type { SiteSettings } from "@/lib/types";
import { SOCIAL_LABEL, SocialIcon } from "./icons";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const { contact, socials, friend_links } = settings;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-ink-deep">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8 xl:px-16">
        {/* The team's call-and-response. */}
        <div className="flex flex-col gap-6 border-b border-line py-14 md:flex-row md:items-end md:justify-between md:py-18">
          <p className="flex flex-col gap-1">
            <span className="font-mono text-[13px] tracking-[0.15em] text-dust md:text-[15px]">WHAT TIME IS IT?</span>
            <span className="font-display text-[112px] leading-[0.82] font-black tracking-tight text-hornet md:text-[220px]">
              12:09!
            </span>
          </p>
          <p className="max-w-sm text-[15px] leading-relaxed text-ash md:mb-3">
            Ask anyone on the team. It&apos;s the call-and-response you&apos;ll hear in the pits at every event.
          </p>
        </div>

        <div className="flex flex-col gap-12 py-14 lg:flex-row lg:justify-between">
          <div className="flex max-w-sm flex-col gap-5">
            <span className="font-display text-4xl leading-none font-black md:text-[44px]">
              ROBOHORNETS <span className="text-hornet">1209</span>
            </span>
            {contact.address && (
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-dust">
                {contact.mapsUrl ? (
                  <a href={contact.mapsUrl} className="hover:text-bone" target="_blank" rel="noopener noreferrer">
                    {contact.address}
                  </a>
                ) : (
                  contact.address
                )}
              </p>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="font-mono text-[15px] text-hornet hover:text-amber">
                {contact.email}
              </a>
            )}
            {socials.length > 0 && (
              <ul className="flex flex-wrap gap-2.5">
                {socials.map((s) => (
                  <li key={s.platform + s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={SOCIAL_LABEL[s.platform] ?? s.platform}
                      className="flex size-11 items-center justify-center rounded-md border border-line-strong text-bone hover:border-hornet hover:text-hornet"
                    >
                      <SocialIcon platform={s.platform} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-10 text-[15px] sm:grid-cols-3 md:gap-24">
            <FooterColumn
              title="Site"
              links={[
                { label: "Team", url: "/team" },
                { label: "Seasons", url: "/seasons" },
                { label: "News", url: "/news" },
                { label: "Outreach", url: "/outreach" },
                { label: "Gallery", url: "/gallery" },
              ]}
            />
            <FooterColumn
              title="Support"
              links={[
                { label: "Sponsors", url: "/sponsors" },
                ...(settings.donate_url ? [{ label: "Donate", url: settings.donate_url }] : []),
                { label: "Contact", url: "/contact" },
              ]}
            />
            {friend_links.length > 0 && <FooterColumn title="Friends" links={friend_links} />}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-line py-6 text-[13px] text-ash sm:flex-row sm:justify-between">
          <span>
            © {year} RoboHornets · FRC Team 1209 · Booker T. Washington High School
          </span>
          <span className="font-mono">btwrobotics.com</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; url: string }[] }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow text-xs text-ash">{title}</span>
      {links.map((l) =>
        l.url.startsWith("/") ? (
          <Link key={l.label} href={l.url} className="text-sand hover:text-bone">
            {l.label}
          </Link>
        ) : (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="text-sand hover:text-bone">
            {l.label}
          </a>
        ),
      )}
    </div>
  );
}

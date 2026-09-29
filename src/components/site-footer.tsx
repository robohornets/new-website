import Link from "next/link";
import type { SiteSettings } from "@/lib/types";
import { SOCIAL_LABEL, SocialIcon } from "./icons";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const { contact, socials, friend_links } = settings;
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-ink-deep">
      <div className="mx-auto max-w-[1440px] px-4 md:px-8 xl:px-16">
        {/* The team's call and response, kept to one line. */}
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-7 md:py-9">
          <span className="text-[15px] font-medium text-dust md:text-lg">What time is it?</span>
          <span className="font-display text-[40px] leading-none font-black text-hornet md:text-[56px]">12:09!</span>
        </p>

        <div className="flex flex-col gap-12 py-14 lg:flex-row lg:justify-between">
          <div className="flex max-w-sm flex-col gap-5">
            <Link href="/" aria-label="RoboHornets home" className="self-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo-lockup-on-dark.svg" alt="" width={518} height={251} className="h-24 w-auto md:h-28" />
            </Link>
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
              <a href={`mailto:${contact.email}`} className="font-label text-[15px] text-hornet hover:text-hornet-hover">
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
            © {year} FRC Team 1209 - RoboHornets · Booker T. Washington High School
          </span>
          <span className="font-label">btwrobotics.com</span>
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

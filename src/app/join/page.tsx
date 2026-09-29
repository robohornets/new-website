import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { getSettings } from "@/lib/data";
import { joinGraduationYears } from "@/lib/join";
import { JoinForm } from "./join-form";

// Only for people the team gives the link to: not linked anywhere or indexed.
export const metadata: Metadata = {
  title: "Ask to join",
  robots: { index: false, follow: false },
};

export default async function JoinPage() {
  const [settings, subteams] = await Promise.all([
    getSettings(),
    all<{ id: number; name: string }>("SELECT id, name FROM subteams WHERE private = 0 ORDER BY sort_order, name"),
  ]);
  const open = settings.join_requests.open;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-[72px] max-w-[760px] items-center px-4">
          <Link href="/" aria-label="RoboHornets home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-lockup-on-dark.svg" alt="" width={518} height={251} className="h-12 w-auto" />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-[760px] grow flex-col gap-8 px-4 py-10 md:py-14">
        <div className="flex flex-col gap-4">
          <span className="eyebrow eyebrow-bar text-bone">FRC Team 1209</span>
          <h1 className="font-display text-6xl leading-[0.9] font-black uppercase md:text-7xl">Ask to join</h1>
          {open && (
            <p className="text-[17px] leading-relaxed text-sand">
              Tell us who you are and which subteams you&apos;d like to be on. A team leader will look at your request and add you to
              the roster.
            </p>
          )}
        </div>
        {open ? (
          <JoinForm subteams={subteams} years={joinGraduationYears()} />
        ) : (
          <p className="rounded-md border border-line bg-panel p-6 text-sand md:p-8">
            Join requests are closed right now. Ask a team leader or mentor when they open, or{" "}
            <Link href="/contact?topic=joining" className="font-semibold text-hornet hover:text-hornet-hover">
              send us a message
            </Link>
            .
          </p>
        )}
      </main>
    </div>
  );
}

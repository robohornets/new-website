"use client";

import { useEffect, useRef, useState } from "react";
import { Close } from "./icons";

/**
 * Only what the public site may show about a person. Built on the server
 * (students already cut down to "First L."), so nothing else reaches the
 * browser.
 */
export type PublicMember = {
  key: number;
  name: string;
  initials: string;
  photo: string | null;
  role: string;
  subteam: string;
  bio: string;
  kind: "student" | "mentor";
  leadership: boolean;
};

// Initials badges in the brand colors; each person always gets the same one.
const BADGES = ["bg-rust text-white", "bg-hornet text-ink", "bg-raise text-hornet ring-1 ring-edge ring-inset"];

function badgeFor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BADGES[h % BADGES.length];
}

function Avatar({ member: m, size }: { member: PublicMember; size: "md" | "lg" }) {
  const box = size === "lg" ? "size-32 text-5xl" : "size-10 text-base sm:size-14 sm:text-xl";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-display font-extrabold ${box} ${m.photo ? "bg-raise" : badgeFor(m.name)}`}>
      {m.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.photo} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{m.initials}</span>
      )}
    </span>
  );
}

function roleColor(m: PublicMember) {
  return m.kind === "mentor" ? "text-mentor" : m.leadership ? "text-hornet" : "text-dust";
}

/** One person: avatar, name and role. With a bio, clicking opens it. */
export function MemberCard({ member: m, showSubteam = false }: { member: PublicMember; showSubteam?: boolean }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const details = [m.role, showSubteam && m.subteam !== m.role ? m.subteam : ""].filter(Boolean).join(" · ");

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const body = (
    <>
      <Avatar member={m} size="md" />
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="truncate text-[15px] font-semibold sm:text-base">{m.name}</span>
        {details && <span className={`truncate text-[13px] ${roleColor(m)}`}>{details}</span>}
      </span>
    </>
  );
  const card = "flex h-full w-full items-center gap-2.5 rounded-md border border-line bg-panel p-2.5 sm:gap-3.5 sm:p-3 sm:pr-4";

  if (!m.bio) return <div className={card}>{body}</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`${card} group transition-colors hover:border-edge hover:bg-raise`}
      >
        {body}
        <span className="ml-auto hidden shrink-0 text-lg text-ash group-hover:text-hornet sm:inline" aria-hidden="true">
          ›
        </span>
        <span className="sr-only">Read about {m.name}</span>
      </button>
      <dialog
        ref={dialogRef}
        aria-label={m.name}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-lg border border-line-strong bg-panel p-0 text-bone shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop:bg-black/70 open:animate-rise"
      >
        {open && (
          <div className="flex flex-col items-center gap-4 px-6 pt-8 pb-7 text-center">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-md text-dust hover:bg-raise hover:text-bone"
            >
              <Close size={20} />
            </button>
            <Avatar member={m} size="lg" />
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-4xl leading-none font-extrabold uppercase">{m.name}</h3>
              <p className={`text-sm ${roleColor(m)}`}>{[m.role, m.subteam !== m.role ? m.subteam : ""].filter(Boolean).join(" · ")}</p>
            </div>
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-sand">{m.bio}</p>
          </div>
        )}
      </dialog>
    </>
  );
}

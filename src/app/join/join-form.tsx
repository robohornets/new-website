"use client";

import { useActionState, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { JOIN_ABOUT_MAX } from "@/lib/join";
import { submitJoinRequest, type JoinState } from "./actions";

type Subteam = { id: number; name: string };

const input =
  "h-12 w-full rounded-md border border-edge bg-ink px-3.5 text-base text-bone placeholder:text-ash focus:border-hornet focus:outline-none";

export function JoinForm({ subteams, years }: { subteams: Subteam[]; years: number[] }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(submitJoinRequest, { ok: false });
  const [about, setAbout] = useState("");

  if (state.ok) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-line bg-panel p-8" role="status">
        <h2 className="font-display text-4xl font-extrabold text-hornet uppercase">Request sent</h2>
        <p className="text-sand">Thanks! A team leader will look at it soon. If you need to change something, fill out the form again with the same name.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6 rounded-md border border-line bg-panel p-6 md:p-8" noValidate>
      {state.error && (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-bone">
          {state.error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" error={state.fieldErrors?.first_name}>
          <input name="first_name" autoComplete="given-name" required maxLength={60} defaultValue={state.values?.first_name} className={input} />
        </Field>
        <Field label="Last name" error={state.fieldErrors?.last_name}>
          <input name="last_name" autoComplete="family-name" required maxLength={60} defaultValue={state.values?.last_name} className={input} />
        </Field>
        <Field label="Graduation year" error={state.fieldErrors?.graduation_year}>
          <select name="graduation_year" defaultValue={state.values?.graduation_year ?? ""} required className={input}>
            <option value="" disabled>
              Choose…
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                Class of {y}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {subteams.length > 0 && <SubteamRanking subteams={subteams} />}

      <Field
        label="Tell us about yourself"
        error={state.fieldErrors?.about}
        hint={`${about.length} / ${JOIN_ABOUT_MAX} characters. What are you interested in? Any experience (none is fine!)?`}
      >
        <textarea
          name="about"
          rows={5}
          maxLength={JOIN_ABOUT_MAX}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          className={`${input} h-auto py-3`}
        />
      </Field>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-13 items-center justify-center self-start rounded-md bg-hornet px-7 font-bold text-ink hover:bg-hornet-hover disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
    </form>
  );
}

/**
 * Drag the subteams into order (mouse or finger, using the handle), or use
 * the arrow buttons. Submits `rank` once per subteam, most wanted first.
 */
function SubteamRanking({ subteams }: { subteams: Subteam[] }) {
  const [order, setOrder] = useState(subteams);
  const [dragging, setDragging] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((o) => {
      const next = [...o];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLElement>, id: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(id);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (dragging === null || !listRef.current) return;
    const items = Array.from(listRef.current.children) as HTMLElement[];
    const from = order.findIndex((s) => s.id === dragging);
    // The slot whose middle the pointer has passed.
    let to = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (to === -1) to = items.length - 1;
    else if (to > from) to -= 1;
    move(from, to);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold">Rank the subteams</legend>
      <p id="rank-help" className="-mt-1 text-sm text-dust">
        Put the one you want most at the top. Drag with the ⠿ handle, or use the arrows.
      </p>
      <ol ref={listRef} aria-describedby="rank-help" className="flex flex-col gap-2">
        {order.map((s, i) => (
          <li
            key={s.id}
            className={`flex h-14 items-center gap-3 rounded-md border bg-ink pr-2 select-none ${
              dragging === s.id ? "border-hornet shadow-[0_6px_24px_rgba(0,0,0,0.5)]" : "border-edge"
            }`}
          >
            <input type="hidden" name="rank" value={s.id} />
            <span
              onPointerDown={(e) => onPointerDown(e, s.id)}
              onPointerMove={onPointerMove}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              className="flex h-full w-11 shrink-0 cursor-grab touch-none items-center justify-center text-xl text-ash active:cursor-grabbing"
              aria-hidden="true"
            >
              ⠿
            </span>
            <span className="w-7 shrink-0 font-label text-lg font-bold text-hornet">{i + 1}</span>
            <span className="grow font-semibold">{s.name}</span>
            <button
              type="button"
              onClick={() => move(i, i - 1)}
              disabled={i === 0}
              aria-label={`Move ${s.name} up`}
              className="flex size-10 items-center justify-center rounded-md border border-line-strong text-bone hover:border-bone disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, i + 1)}
              disabled={i === order.length - 1}
              aria-label={`Move ${s.name} down`}
              className="flex size-10 items-center justify-center rounded-md border border-line-strong text-bone hover:border-bone disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      {children}
      {hint && !error && <span className="text-sm font-normal text-dust">{hint}</span>}
      {error && <span className="text-sm font-normal text-danger">{error}</span>}
    </label>
  );
}

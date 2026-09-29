"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RosterMember, Subteam } from "@/lib/types";
import { ActionButton } from "../_components/action-form";
import { Checkbox, inputClass, TextField } from "../_components/fields";
import { PhotoThumbField } from "../_components/media-field";
import { EditForm } from "../_components/unsaved";
import { removeRosterEntry, updateRosterRow } from "./actions";

const ANY = "";
const NONE = "none";

const filterClass = "h-10 rounded-md border border-edge bg-ink px-3 text-sm text-bone focus:border-hornet focus:outline-none";

/** The season's roster with search and filters. Each row saves through the save bar. */
export function RosterList({ members, subteams, year }: { members: RosterMember[]; subteams: Subteam[]; year: number }) {
  const [query, setQuery] = useState("");
  const [subteam, setSubteam] = useState(ANY);
  const [grad, setGrad] = useState(ANY);
  const [leadership, setLeadership] = useState(ANY);

  const gradYears = useMemo(
    () => [...new Set(members.map((m) => m.graduation_year).filter((y): y is number => y !== null))].sort((a, b) => a - b),
    [members],
  );

  const q = query.trim().toLowerCase();
  const visible = (m: RosterMember) => {
    if (q && !`${m.first_name} ${m.last_name}`.toLowerCase().includes(q)) return false;
    if (subteam === NONE && (m.subteam_id !== null || m.extra_subteam_ids.length > 0)) return false;
    if (subteam !== ANY && subteam !== NONE) {
      const id = Number(subteam);
      if (m.subteam_id !== id && !m.extra_subteam_ids.includes(id)) return false;
    }
    if (grad === NONE && m.graduation_year !== null) return false;
    if (grad !== ANY && grad !== NONE && m.graduation_year !== Number(grad)) return false;
    if (leadership === "yes" && !m.is_leadership) return false;
    if (leadership === "no" && m.is_leadership) return false;
    return true;
  };
  const shown = members.filter(visible).length;
  const filtered = q || subteam || grad || leadership;

  return (
    <div className="flex flex-col gap-4">
      <div role="search" className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-ink p-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          aria-label="Search the roster by name"
          className={`${filterClass} min-w-48 grow`}
        />
        <select value={subteam} onChange={(e) => setSubteam(e.target.value)} aria-label="Filter by subteam" className={filterClass}>
          <option value={ANY}>All subteams</option>
          {subteams.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={NONE}>No subteam</option>
        </select>
        <select value={grad} onChange={(e) => setGrad(e.target.value)} aria-label="Filter by graduation year" className={filterClass}>
          <option value={ANY}>Any graduation year</option>
          {gradYears.map((y) => (
            <option key={y} value={y}>
              Class of {y}
            </option>
          ))}
          <option value={NONE}>Not set</option>
        </select>
        <select value={leadership} onChange={(e) => setLeadership(e.target.value)} aria-label="Filter by leadership" className={filterClass}>
          <option value={ANY}>Leadership or not</option>
          <option value="yes">Leadership only</option>
          <option value="no">Not leadership</option>
        </select>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSubteam(ANY);
              setGrad(ANY);
              setLeadership(ANY);
            }}
            className="h-10 px-2 text-sm font-semibold text-hornet hover:text-hornet-hover"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-sm text-dust" aria-live="polite">
        {filtered ? `Showing ${shown} of ${members.length}` : `${members.length} people`}
      </p>

      <ul className="flex flex-col divide-y divide-line">
        {members.map((m) => (
          // Hidden rather than removed, so unsaved edits survive changing the filters.
          <li key={m.entry_id} hidden={!visible(m)} className="py-3">
            <RosterRow member={m} subteams={subteams} year={year} />
          </li>
        ))}
      </ul>
      {filtered && shown === 0 && <p className="text-sm text-dust">Nobody matches those filters.</p>}
    </div>
  );
}

function RosterRow({ member: m, subteams, year }: { member: RosterMember; subteams: Subteam[]; year: number }) {
  const name = `${m.first_name} ${m.last_name}`.trim();
  const initials = `${m.first_name[0] ?? ""}${m.last_name[0] ?? ""}`.toUpperCase();
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
      <EditForm action={updateRosterRow.bind(null, m.entry_id, m.id)} className="grow gap-3">
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.2fr)_1fr_1fr_120px_auto]">
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1 lg:pb-0.5">
            <PhotoThumbField
              name="photo_media_id"
              label={name}
              initials={initials}
              current={m.photo_media_id && m.photo_key ? { id: m.photo_media_id, r2_key: m.photo_key, filename: "" } : null}
            />
            <div className="flex min-w-0 flex-col">
              <Link href={`/admin/people/${m.id}`} className="truncate font-semibold hover:text-hornet">
                {name}
              </Link>
              <span className="flex flex-wrap gap-x-2 font-label text-[11px] uppercase">
                <span className={m.kind === "mentor" ? "text-mentor" : "text-ash"}>{m.kind}</span>
                {m.is_leadership === 1 && <span className="text-hornet">Leadership</span>}
              </span>
            </div>
          </div>
          <TextField label="Role" name="role" defaultValue={m.role} />
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Subteam
            <select name="subteam_id" defaultValue={m.subteam_id ?? ""} className={inputClass}>
              <option value="">None</option>
              {subteams.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.private ? " (private)" : ""}
                </option>
              ))}
            </select>
          </label>
          <TextField label="Graduates" name="graduation_year" type="number" defaultValue={m.graduation_year} placeholder={String(year + 1)} />
          <div className="pb-2.5">
            <Checkbox label="Leadership" name="is_leadership" defaultChecked={m.is_leadership === 1} />
          </div>
        </div>
        <details className="group rounded-md border border-line bg-ink/40 open:bg-ink">
          <summary className="flex h-9 cursor-pointer list-none items-center gap-2 px-3 text-sm text-dust hover:text-bone">
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">
              ›
            </span>
            More: other subteams, photo privacy, order
            {m.extra_subteam_ids.length > 0 && (
              <span className="text-ash">
                · also on {m.extra_subteam_ids.map((id) => subteams.find((s) => s.id === id)?.name).filter(Boolean).join(", ")}
              </span>
            )}
          </summary>
          <div className="flex flex-col gap-4 border-t border-line p-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-sm font-semibold">Also on</legend>
              <div className="flex flex-wrap gap-2">
                {subteams.map((s) => (
                  <label
                    key={s.id}
                    className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line-strong px-3 text-sm has-checked:border-hornet has-checked:bg-hornet/10"
                  >
                    <input
                      type="checkbox"
                      name="extra_subteam"
                      value={s.id}
                      defaultChecked={m.extra_subteam_ids.includes(s.id)}
                      className="size-4 accent-hornet"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-end gap-6">
              <Checkbox
                label="Show photo on the public site"
                name="show_photo"
                defaultChecked={m.show_photo === 1}
                hint={m.kind === "student" ? "Leave off unless you have permission." : undefined}
              />
              <TextField label="Order" name="sort_order" type="number" defaultValue={m.sort_order} hint="Lower shows first." className="w-32" />
            </div>
          </div>
        </details>
      </EditForm>
      <div className="xl:pt-7">
        <ActionButton action={removeRosterEntry.bind(null, m.entry_id)} variant="danger" confirm={`Remove ${name} from the ${year} roster?`}>
          Remove
        </ActionButton>
      </div>
    </div>
  );
}

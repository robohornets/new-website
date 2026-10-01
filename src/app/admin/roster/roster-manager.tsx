"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin";
import { mediaUrl } from "@/lib/media";
import type { Person, RosterMember, Subteam } from "@/lib/types";
import { Pencil } from "@/components/icons";
import { inputClass } from "../_components/fields";
import { LibraryPicker } from "../_components/library-picker";
import { Modal, useConfirm } from "../_components/modal";
import { TrashButton } from "../_components/items";
import { hasChanges } from "../_components/unsaved";
import {
  addExistingPerson,
  addNewPerson,
  createSubteam,
  deleteSubteam,
  removeRosterEntry,
  saveRosterMember,
  saveSubteams,
} from "./actions";
import { seasonLabel } from "@/lib/format";

const ANY = "";
const NONE = "none";

const filterClass = "h-10 rounded-md border border-edge bg-ink px-3 text-sm text-bone focus:border-hornet focus:outline-none";
const primaryButton = "flex h-10 items-center justify-center gap-2 rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-hornet-hover disabled:opacity-60";
const secondaryButton =
  "flex h-10 items-center justify-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-bone hover:border-bone disabled:opacity-60";
const quietButton = "flex h-10 items-center rounded-md px-4 text-sm font-semibold text-sand hover:bg-raise hover:text-bone";
const dangerButton = "flex h-10 items-center rounded-md border border-danger/60 px-4 text-sm font-semibold text-danger hover:bg-danger/10";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/** The season's roster as cards, with Add, Edit and Remove in popups. */
export function RosterManager({
  members,
  subteams,
  others,
  year,
}: {
  members: RosterMember[];
  subteams: Subteam[];
  others: Person[];
  year: number;
}) {
  const [query, setQuery] = useState("");
  const [subteam, setSubteam] = useState(ANY);
  const [grad, setGrad] = useState(ANY);
  const [leadership, setLeadership] = useState(ANY);
  const [editing, setEditing] = useState<RosterMember | null>(null);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const confirm = useConfirm();
  const [, startTransition] = useTransition();

  function flash(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  const gradYears = useMemo(
    () => [...new Set(members.map((m) => m.graduation_year).filter((y): y is number => y !== null))].sort((a, b) => a - b),
    [members],
  );
  const subteamName = (id: number | null) => subteams.find((s) => s.id === id)?.name;

  const q = query.trim().toLowerCase();
  const shown = members.filter((m) => {
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
  });
  const filtered = Boolean(q || subteam || grad || leadership);

  async function remove(m: RosterMember): Promise<void> {
    const name = `${m.first_name} ${m.last_name}`.trim();
    const ok = await confirm({
      title: `Remove ${m.first_name}?`,
      message: `${name} comes off the ${seasonLabel(year)} roster. Earlier seasons keep them, and you can add them back from "Someone from another season".`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await removeRosterEntry(m.entry_id, { ok: false });
      if (result.ok) setEditing(null);
      flash(result.ok ? `${m.first_name} removed from ${seasonLabel(year)}.` : (result.error ?? "That didn't work."));
    });
  }

  const counts = (id: number) => members.filter((m) => m.subteam_id === id || m.extra_subteam_ids.includes(id)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAdding(true)} className={primaryButton}>
          <span aria-hidden="true" className="text-lg leading-none">
            +
          </span>
          Add person
        </button>
        <button type="button" onClick={() => setManaging(true)} className={secondaryButton}>
          Manage subteams
        </button>
        <span className="ml-auto text-sm text-dust" aria-live="polite">
          {filtered ? `Showing ${shown.length} of ${members.length}` : `${members.length} ${members.length === 1 ? "person" : "people"}`}
        </span>
      </div>

      {members.length > 0 && (
        <div role="search" className="flex flex-wrap items-center gap-2">
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
            <option value={ANY}>Any class</option>
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
      )}

      {members.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-8 text-center text-sm text-dust">
          Nobody on the {seasonLabel(year)} roster yet. Click <span className="font-semibold text-bone">Add person</span> to start.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-dust">Nobody matches those filters.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
          {shown.map((m) => (
            <MemberCard key={m.entry_id} member={m} subteamName={subteamName} onEdit={() => setEditing(m)} />
          ))}
        </ul>
      )}

      {editing && (
        <MemberModal
          key={editing.entry_id}
          title={`Edit ${editing.first_name}`}
          submitLabel="Save"
          action={saveRosterMember.bind(null, editing.entry_id, editing.id)}
          danger={
            <button type="button" onClick={() => remove(editing)} className={dangerButton}>
              Remove from {seasonLabel(year)}
            </button>
          }
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            flash(message);
          }}
        >
          <MemberFields member={editing} subteams={subteams} year={year} />
          <p className="text-xs text-dust">
            Name, class, photo and bio are the same in every season. Role and subteams are just for {seasonLabel(year)}.{" "}
            <Link href={`/admin/people/${editing.id}`} className="font-semibold text-hornet hover:text-hornet-hover">
              See all their seasons
            </Link>
          </p>
        </MemberModal>
      )}

      {adding && (
        <AddModal
          year={year}
          subteams={subteams}
          others={others}
          onClose={() => setAdding(false)}
          onDone={(message) => {
            setAdding(false);
            flash(message);
          }}
        />
      )}

      {managing && <SubteamsModal subteams={subteams} counts={counts} year={year} onClose={() => setManaging(false)} onFlash={flash} />}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4 lg:pl-[264px]" role="status">
          <span className="animate-rise rounded-lg border border-line-strong bg-raise px-5 py-3 text-[15px] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}

// ---- Cards --------------------------------------------------------------------

function initialsOf(m: { first_name: string; last_name: string }) {
  return `${m.first_name[0] ?? ""}${m.last_name[0] ?? ""}`.toUpperCase() || "?";
}

function Avatar({ photoKey, initials, size = "md" }: { photoKey: string | null; initials: string; size?: "md" | "lg" }) {
  const src = mediaUrl(photoKey, 320);
  const box = size === "lg" ? "size-24 text-2xl" : "size-12 text-sm";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-raise ${box}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-label font-bold text-dust">{initials}</span>
      )}
    </span>
  );
}

function MemberCard({
  member: m,
  subteamName,
  onEdit,
}: {
  member: RosterMember;
  subteamName: (id: number | null) => string | undefined;
  onEdit: () => void;
}) {
  const name = `${m.first_name} ${m.last_name}`.trim();
  const main = subteamName(m.subteam_id);
  const extras = m.extra_subteam_ids.map(subteamName).filter(Boolean);
  const details = [m.role, main, m.graduation_year ? `Class of ${m.graduation_year}` : null].filter(Boolean).join(" · ");
  const photoHidden = Boolean(m.photo_key) && m.show_photo !== 1;

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onEdit}
        aria-haspopup="dialog"
        aria-label={`Edit ${name}`}
        className="group flex w-full min-w-0 items-center gap-3 rounded-md border border-line bg-ink px-3 py-3 text-left hover:border-edge focus-visible:border-hornet sm:gap-4 sm:px-4"
      >
        <Avatar photoKey={m.photo_key} initials={initialsOf(m)} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold group-hover:text-hornet">{name}</span>
            {m.is_leadership === 1 && (
              <span className="rounded bg-rust px-1.5 py-0.5 font-label text-[10px] font-bold tracking-wide text-white">LEADERSHIP</span>
            )}
            {m.kind === "mentor" && (
              <span className="rounded border border-mentor/50 px-1.5 py-0.5 font-label text-[10px] font-bold tracking-wide text-mentor">MENTOR</span>
            )}
          </span>
          <span className="truncate text-sm text-dust">
            {details}
            {extras.length > 0 && <span className="text-ash"> · also {extras.join(", ")}</span>}
          </span>
          {photoHidden && <span className="text-xs text-ash">Photo hidden on the site</span>}
        </span>
        <Pencil size={16} className="shrink-0 text-dust group-hover:text-hornet" />
      </button>
    </li>
  );
}

// ---- Edit / add popups --------------------------------------------------------

/**
 * A popup around a form that runs `action`. Save closes it; closing with
 * changes asks first.
 */
function MemberModal({
  title,
  description,
  submitLabel,
  action,
  onClose,
  onDone,
  children,
  header,
  danger,
}: {
  title: string;
  description?: ReactNode;
  submitLabel: string;
  action: Action;
  onClose: () => void;
  onDone: (message: string) => void;
  children: ReactNode;
  /** Shown above the form (the add popup's New / Returning switch). */
  header?: ReactNode;
  /** A red button at the start of the footer (Remove from the season). */
  danger?: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function requestClose() {
    if (pending) return;
    if (formRef.current && hasChanges(formRef.current)) {
      const discard = await confirm({
        title: "Discard changes?",
        message: "You've changed something in this popup. Close it without saving?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!discard) return;
    }
    onClose();
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await action({ ok: false }, fd);
      if (result.ok) onDone(result.message ?? "Saved.");
      else setError(result.error ?? "That didn't save. Please try again.");
    });
  }

  const formId = `member-form-${title.replace(/\W+/g, "-")}`;
  return (
    <Modal
      open
      onClose={requestClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          {danger && <span className="mr-auto">{danger}</span>}
          {error && (
            <p role="alert" className={`text-sm text-danger ${danger ? "" : "mr-auto"}`}>
              {error}
            </p>
          )}
          <button type="button" onClick={requestClose} className={quietButton}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : submitLabel}
          </button>
        </>
      }
    >
      {header}
      <form id={formId} ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
        {children}
      </form>
    </Modal>
  );
}

function AddModal({
  year,
  subteams,
  others,
  onClose,
  onDone,
}: {
  year: number;
  subteams: Subteam[];
  others: Person[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [mode, setMode] = useState<"new" | "returning">("new");
  const tab = (value: "new" | "returning", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === value}
      onClick={() => setMode(value)}
      className={`flex h-9 grow items-center justify-center rounded px-4 text-sm font-semibold sm:grow-0 ${
        mode === value ? "bg-bone text-ink" : "text-sand hover:text-bone"
      }`}
    >
      {label}
    </button>
  );
  return (
    <MemberModal
      key={mode}
      title={`Add to ${seasonLabel(year)}`}
      submitLabel="Add to roster"
      action={mode === "new" ? addNewPerson.bind(null, year) : addExistingPerson.bind(null, year)}
      onClose={onClose}
      onDone={onDone}
      header={
        others.length > 0 ? (
          <div role="tablist" aria-label="Who are you adding?" className="mb-5 flex gap-1 rounded-md border border-line bg-ink p-1">
            {tab("new", "New person")}
            {tab("returning", "Someone from another season")}
          </div>
        ) : null
      }
    >
      {mode === "new" ? (
        <MemberFields subteams={subteams} year={year} />
      ) : (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Person
            <select name="person_id" defaultValue="" required className={inputClass}>
              <option value="" disabled>
                Choose…
              </option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                  {p.kind === "mentor" ? " (mentor)" : p.graduation_year ? ` (class of ${p.graduation_year})` : ""}
                </option>
              ))}
            </select>
          </label>
          <SeasonFields subteams={subteams} />
        </>
      )}
    </MemberModal>
  );
}

// ---- Fields -------------------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full eyebrow text-[11px] text-ash">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-semibold ${className}`}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-dust">{hint}</span>}
    </label>
  );
}

function MemberFields({ member: m, subteams, year }: { member?: RosterMember; subteams: Subteam[]; year: number }) {
  const [kind, setKind] = useState(m?.kind ?? "student");
  return (
    <>
      <Section title="Photo">
        <PhotoField
          current={m?.photo_media_id && m.photo_key ? { id: m.photo_media_id, key: m.photo_key } : null}
          showPhoto={m ? m.show_photo === 1 : false}
          initials={m ? initialsOf(m) : "+"}
          kind={kind}
        />
      </Section>
      <Section title="Person">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <input name="first_name" defaultValue={m?.first_name} required maxLength={80} className={inputClass} />
          </Field>
          <Field label="Last name" hint={kind === "student" ? "Students show as the initial only." : undefined}>
            <input name="last_name" defaultValue={m?.last_name} maxLength={80} className={inputClass} />
          </Field>
          <Field label="Type">
            <select name="kind" defaultValue={m?.kind ?? "student"} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputClass}>
              <option value="student">Student</option>
              <option value="mentor">Mentor / teacher sponsor</option>
            </select>
          </Field>
          <Field label="Graduation year" hint={kind === "student" ? "Graduates are left off when you start a new season." : "Leave blank for mentors."}>
            <input name="graduation_year" type="number" defaultValue={m?.graduation_year ?? ""} placeholder={String(year + 1)} className={inputClass} />
          </Field>
        </div>
        <Field label="Short bio" hint="Public: anyone can read it by clicking their card on the Team page. Leave blank to keep their card plain.">
          <textarea name="bio" rows={2} defaultValue={m?.bio} maxLength={1000} className={`${inputClass} h-auto py-2.5`} />
        </Field>
      </Section>
      <Section title={`${seasonLabel(year)} season`}>
        <SeasonFields member={m} subteams={subteams} />
      </Section>
    </>
  );
}

/** Role, subteams, leadership and order: the parts that belong to one season. */
function SeasonFields({ member: m, subteams }: { member?: RosterMember; subteams: Subteam[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_110px]">
        <Field label="Role">
          <input name="role" defaultValue={m?.role ?? ""} placeholder="Member" maxLength={80} className={inputClass} />
        </Field>
        <Field label="Main subteam">
          <select name="subteam_id" defaultValue={m?.subteam_id ?? ""} className={inputClass}>
            <option value="">None</option>
            {subteams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.private ? " (private)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order" hint="Lower first">
          <input name="sort_order" type="number" defaultValue={m?.sort_order ?? 0} className={inputClass} />
        </Field>
      </div>
      {subteams.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">Also on</legend>
          <div className="flex flex-wrap gap-2">
            {subteams.map((s) => (
              <label
                key={s.id}
                className="flex h-9 items-center gap-2 rounded-full border border-line-strong px-3 text-sm has-checked:border-hornet has-checked:bg-hornet/10"
              >
                <input
                  type="checkbox"
                  name="extra_subteam"
                  value={s.id}
                  defaultChecked={m?.extra_subteam_ids.includes(s.id)}
                  className="size-4 accent-hornet"
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="flex items-center gap-3 text-[15px]">
        <input type="checkbox" name="is_leadership" defaultChecked={m?.is_leadership === 1} className="size-5 accent-hornet" />
        Leadership (captains and leads, listed first)
      </label>
    </>
  );
}

/** Add, replace or remove a photo, and whether it shows on the public site. */
function PhotoField({
  current,
  showPhoto,
  initials,
  kind,
}: {
  current: { id: number; key: string } | null;
  showPhoto: boolean;
  initials: string;
  kind: string;
}) {
  const [photo, setPhoto] = useState(current);
  const [picking, setPicking] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <input type="hidden" name="photo_media_id" value={photo?.id ?? ""} data-default={current?.id ?? ""} />
      <Avatar photoKey={photo?.key ?? null} initials={initials} size="lg" />
      <div className="flex min-w-0 grow flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPicking(true)} aria-haspopup="dialog" className={secondaryButton}>
            {photo ? "Change photo" : "Add photo"}
          </button>
          {photo && (
            <button type="button" onClick={() => setPhoto(null)} className="flex h-10 items-center rounded-md px-3 text-sm font-semibold text-danger hover:bg-danger/10">
              Remove photo
            </button>
          )}
          <LibraryPicker
            open={picking}
            onClose={() => setPicking(false)}
            title="Photo"
            kinds={["image"]}
            onPick={([m]) => m && setPhoto({ id: m.id, key: m.r2_key })}
          />
        </div>
        <label className="flex items-start gap-3 text-[15px]">
          <input type="checkbox" name="show_photo" defaultChecked={showPhoto} className="mt-0.5 size-5 shrink-0 accent-hornet" />
          <span className="flex flex-col gap-0.5">
            Show photo on the public site
            <span className="text-xs text-dust">
              {kind === "student" ? "Off hides it but keeps it here. Only turn on with permission." : "Off hides it but keeps it here."}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

// ---- Subteams -----------------------------------------------------------------

function SubteamsModal({
  subteams,
  counts,
  year,
  onClose,
  onFlash,
}: {
  subteams: Subteam[];
  counts: (id: number) => number;
  year: number;
  onClose: () => void;
  onFlash: (message: string) => void;
}) {
  const listRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  async function requestClose() {
    if (pending) return;
    if (listRef.current && hasChanges(listRef.current)) {
      const discard = await confirm({
        title: "Discard changes?",
        message: "You renamed or changed a subteam without saving. Close anyway?",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!discard) return;
    }
    onClose();
  }

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);
    startTransition(async () => {
      const result = await createSubteam({ ok: false }, fd);
      if (result.ok) {
        form.reset();
        onFlash(result.message ?? "Added.");
      } else setError(result.error ?? "That didn't work.");
    });
  }

  async function remove(t: Subteam) {
    const n = counts(t.id);
    const ok = await confirm({
      title: `Delete ${t.name}?`,
      message:
        n > 0
          ? `${n} ${n === 1 ? "person is" : "people are"} on ${t.name} this season. They stay on the roster with no subteam.`
          : `Nobody on the ${seasonLabel(year)} roster is on ${t.name}.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteSubteam(t.id);
      onFlash(`${t.name} deleted.`);
    });
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveSubteams({ ok: false }, fd);
      if (result.ok) {
        onFlash("Subteams saved.");
        onClose();
      } else setError(result.error ?? "That didn't save.");
    });
  }

  return (
    <Modal
      open
      onClose={requestClose}
      title="Subteams"
      description="The list for everyone's subteam dropdown and the join form. Private ones (like Drive Team) can't be picked on the join form."
      footer={
        <>
          {error && (
            <p role="alert" className="mr-auto text-sm text-danger">
              {error}
            </p>
          )}
          <button type="button" onClick={requestClose} className={quietButton}>
            Close
          </button>
          <button type="submit" form="subteams-list" disabled={pending || subteams.length === 0} className={primaryButton}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-edge p-3">
          <Field label="New subteam" className="min-w-48 grow">
            <input name="name" placeholder="Pit Crew" maxLength={60} className={inputClass} />
          </Field>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="private" className="size-4 accent-hornet" />
            Private
          </label>
          <button type="submit" disabled={pending} className={secondaryButton}>
            Add
          </button>
        </form>

        <form id="subteams-list" ref={listRef} onSubmit={save} noValidate>
          <input type="hidden" name="ids" value={subteams.map((t) => t.id).join(",")} />
          <ul className="flex flex-col divide-y divide-line">
            {subteams.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <input type="number" name={`order_${t.id}`} defaultValue={t.sort_order} aria-label={`${t.name}: order`} className={inputClass.replace("w-full", "w-16")} />
                <input name={`name_${t.id}`} defaultValue={t.name} aria-label={`${t.name}: name`} className={`${inputClass.replace("w-full", "w-auto")} min-w-40 grow basis-40`} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`private_${t.id}`} defaultChecked={t.private === 1} className="size-4 accent-hornet" />
                  Private
                </label>
                <span className="w-20 text-right text-xs text-dust">{counts(t.id) === 1 ? "1 person" : `${counts(t.id)} people`}</span>
                <TrashButton label={`Delete ${t.name}`} onClick={() => remove(t)} />
              </li>
            ))}
          </ul>
          {subteams.length === 0 && <p className="text-sm text-dust">No subteams yet. Add one above.</p>}
        </form>
      </div>
    </Modal>
  );
}

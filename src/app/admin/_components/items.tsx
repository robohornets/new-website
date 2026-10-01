"use client";

// The one way lists work in the admin:
//
//   - Every item is a row (or card) you click anywhere on.
//   - Small things (a sponsor, a resource, a photo) open in a popup: ✎ on the row.
//   - Big things with their own lists (a season, robot, event, album) open
//     their own page: → on the row.
//   - Adding is a "+ Add …" button at the top of the list, opening a popup.
//   - Delete is always the last thing inside, in red, and asks first.
//   - Tiny lists (tiers, subteams) are edited right in the list, with a
//     trash button on each row.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ChevronRight, Pencil, Plus } from "@/components/icons";
import type { ActionState } from "@/lib/admin";
import { Modal, useConfirm } from "./modal";
import { hasChanges } from "./unsaved";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;
type Destroy = (prev: ActionState) => Promise<ActionState>;

export const buttonStyles = {
  primary: "flex h-10 items-center justify-center gap-2 rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-hornet-hover disabled:opacity-60",
  secondary:
    "flex h-10 items-center justify-center gap-2 rounded-md border border-line-strong px-4 text-sm font-semibold text-bone hover:border-bone disabled:opacity-60",
  quiet: "flex h-10 items-center rounded-md px-4 text-sm font-semibold text-sand hover:bg-raise hover:text-bone",
  danger: "flex h-10 items-center justify-center gap-2 rounded-md border border-danger/60 px-4 text-sm font-semibold text-danger hover:bg-danger/10 disabled:opacity-60",
};

/** The look shared by every clickable row. */
const rowClass =
  "group flex w-full min-w-0 items-center gap-4 rounded-md border border-line bg-ink px-4 py-3 text-left hover:border-edge focus-visible:border-hornet";

/** What goes inside a row: an optional thumbnail, a title, a line of detail, badges on the right. */
export function RowContent({
  media,
  title,
  meta,
  badges,
  opens,
}: {
  media?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  /** "popup" shows ✎, "page" shows →. */
  opens: "popup" | "page";
}) {
  return (
    <>
      {media && <span className="shrink-0">{media}</span>}
      <span className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate font-semibold group-hover:text-hornet">{title}</span>
        {meta && <span className="truncate font-label text-xs text-dust">{meta}</span>}
      </span>
      {badges && <span className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs">{badges}</span>}
      <span className="shrink-0 text-dust group-hover:text-hornet" aria-hidden="true">
        {opens === "page" ? <ChevronRight size={18} /> : <Pencil size={16} />}
      </span>
    </>
  );
}

/** A row that opens its own page. */
export function LinkRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={rowClass}>
      {children}
    </Link>
  );
}

/** A small badge on a row ("GOLD", "HIDDEN", "TEAM"). */
export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "accent" | "muted" }) {
  const look = {
    plain: "border border-line-strong text-sand",
    accent: "bg-rust font-bold text-white",
    muted: "bg-raise text-dust",
  }[tone];
  return <span className={`rounded px-1.5 py-0.5 font-label text-[10px] tracking-wider uppercase ${look}`}>{children}</span>;
}

/**
 * A popup around a form. Its own Save button runs `action`; closing with
 * changes asks first. `destroy` adds a red delete button as the last thing
 * in the popup, which asks before it runs.
 */
export function FormModal({
  title,
  description,
  submitLabel = "Save",
  action,
  destroy,
  onClose,
  onDone,
  size = "md",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  submitLabel?: string;
  action: Action;
  destroy?: { label: string; confirm: string; action: Destroy };
  onClose: () => void;
  onDone: (message: string) => void;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
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

  async function remove() {
    if (!destroy || pending) return;
    if (!(await confirm({ message: destroy.confirm, confirmLabel: destroy.label, danger: true }))) return;
    setError(null);
    startTransition(async () => {
      const result = await destroy.action({ ok: false });
      if (result.ok) onDone(result.message ?? "Deleted.");
      else setError(result.error ?? "That didn't work. Please try again.");
    });
  }

  const formId = useId();
  return (
    <Modal
      open
      onClose={requestClose}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          {destroy && (
            <button type="button" onClick={remove} disabled={pending} className={`${buttonStyles.danger} mr-auto`}>
              {destroy.label}
            </button>
          )}
          {error && (
            <p role="alert" className={`text-sm text-danger ${destroy ? "" : "mr-auto"}`}>
              {error}
            </p>
          )}
          <button type="button" onClick={requestClose} className={buttonStyles.quiet}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={pending} className={buttonStyles.primary}>
            {pending ? "Saving…" : submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
        {children}
      </form>
    </Modal>
  );
}

/** "Saved." for a moment at the bottom of the screen, after a popup closes. */
function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = (m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2200);
  };
  const toast = message ? (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4 lg:pl-[264px]" role="status">
      <span className="animate-rise rounded-lg border border-line-strong bg-raise px-5 py-3 text-[15px] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.55)]">{message}</span>
    </div>
  ) : null;
  return { show, toast };
}

/**
 * A row that opens a popup to edit the item. The fields are passed as
 * children (rendered on the server); `row` is what the row shows.
 */
export function ModalItem({
  row,
  title,
  description,
  action,
  destroy,
  size,
  children,
}: {
  row: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action: Action;
  destroy?: { label: string; confirm: string; action: Destroy };
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { show, toast } = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={rowClass} aria-haspopup="dialog">
        {row}
      </button>
      {open && (
        <FormModal
          title={title}
          description={description}
          action={action}
          destroy={destroy}
          size={size}
          onClose={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            show(m);
            router.refresh();
          }}
        >
          {children}
        </FormModal>
      )}
      {toast}
    </>
  );
}

/**
 * "+ Add …" at the top of a list: opens a popup with the fields. Actions
 * that create something with its own page can redirect there.
 */
export function AddButton({
  label,
  title,
  description,
  action,
  submitLabel,
  size,
  children,
}: {
  label: string;
  title: ReactNode;
  description?: ReactNode;
  action: Action;
  submitLabel?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { show, toast } = useToast();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonStyles.primary} aria-haspopup="dialog">
        <Plus size={16} /> {label}
      </button>
      {open && (
        <FormModal
          title={title}
          description={description}
          action={action}
          submitLabel={submitLabel ?? label}
          size={size}
          onClose={() => setOpen(false)}
          onDone={(m) => {
            setOpen(false);
            show(m);
            router.refresh();
          }}
        >
          {children}
        </FormModal>
      )}
      {toast}
    </>
  );
}

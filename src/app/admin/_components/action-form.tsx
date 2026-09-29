"use client";

import { useActionState, useRef, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/admin";
import { useConfirm } from "./modal";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** A form bound to an admin Server Action that shows "Saved." or the error inline. */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel = "Save",
  submitVariant = "primary",
  hideSubmit = false,
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  submitLabel?: string;
  submitVariant?: "primary" | "secondary" | "danger";
  hideSubmit?: boolean;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { ok: false });
  return (
    <form
      action={formAction}
      // A new key after a successful create clears the inputs for the next entry.
      key={resetOnSuccess && state.ok ? state.at : undefined}
      className={`flex flex-col gap-4 ${className}`}
    >
      {children}
      {!hideSubmit && (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant={submitVariant}>{submitLabel}</SubmitButton>
          <FormStatus state={state} />
        </div>
      )}
      {hideSubmit && <FormStatus state={state} />}
    </form>
  );
}

export function FormStatus({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <span role="alert" className="text-sm text-danger">
        {state.error}
      </span>
    );
  }
  if (state.ok && state.message) {
    return (
      <span role="status" key={state.at} className="text-sm text-hornet">
        {state.message}
      </span>
    );
  }
  return null;
}

/**
 * onClick for a submit button that should ask first: stops the click, shows
 * the site's confirm dialog, and submits with this same button if they agree.
 */
function useConfirmedSubmit(message: string | undefined, confirmLabel: string, danger: boolean) {
  const ask = useConfirm();
  const confirmed = useRef(false);
  return (e: MouseEvent<HTMLButtonElement>) => {
    if (!message || confirmed.current) {
      confirmed.current = false;
      return;
    }
    e.preventDefault();
    const button = e.currentTarget;
    void ask({ message, confirmLabel, danger }).then((ok) => {
      if (!ok) return;
      confirmed.current = true;
      button.form?.requestSubmit(button);
    });
  };
}

function labelOf(children: ReactNode, fallback: string) {
  return typeof children === "string" ? children : fallback;
}

const VARIANTS = {
  primary: "bg-hornet text-ink hover:bg-hornet-hover",
  secondary: "border border-line-strong text-bone hover:border-bone",
  danger: "border border-danger/60 text-danger hover:bg-danger/10",
};

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  confirm,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const onClick = useConfirmedSubmit(confirm, labelOf(children, "Yes"), variant === "danger");
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/** A one-button form (delete, archive, make current…) with an optional confirm prompt. */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  confirm,
  fields,
}: {
  action: Action;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  confirm?: string;
  fields?: Record<string, string | number>;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { ok: false });
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      {fields &&
        Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={String(v)} />)}
      <SubmitButton variant={variant} confirm={confirm}>
        {children}
      </SubmitButton>
      <FormStatus state={state} />
    </form>
  );
}

"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Close } from "@/components/icons";

/**
 * A popup built on <dialog>: the rest of the page can't be clicked or tabbed
 * to while it's open. Esc and clicking outside call onClose (which can say no,
 * e.g. to ask about unsaved changes first).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = { sm: "max-w-[440px]", md: "max-w-[640px]", lg: "max-w-[860px]" }[size];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Esc: let the owner decide.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) onClose();
      }}
      className={`m-auto w-[calc(100%-24px)] ${width} max-h-[min(92dvh,900px)] overflow-hidden rounded-lg border border-line-strong bg-panel p-0 text-bone shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop:bg-black/70 open:flex open:animate-rise open:flex-col`}
    >
      {open && (
        <>
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 md:px-6">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={titleId} className="font-display text-3xl leading-none font-extrabold uppercase">
                {title}
              </h2>
              {description && <p className="text-sm text-dust">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-md text-dust hover:bg-raise hover:text-bone"
            >
              <Close size={20} />
            </button>
          </header>
          {children && <div className="min-h-0 grow overflow-y-auto px-5 py-5 md:px-6">{children}</div>}
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 md:px-6">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}

// ---- Confirm ------------------------------------------------------------------

type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Lets any admin component ask "Are you sure?" with the site's own dialog. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    [],
  );

  function answer(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => answer(false)}
        size="sm"
        title={pending?.title ?? "Are you sure?"}
        footer={
          <>
            <button
              type="button"
              onClick={() => answer(false)}
              className="flex h-10 items-center rounded-md px-4 text-sm font-semibold text-sand hover:bg-raise hover:text-bone"
            >
              {pending?.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => answer(true)}
              className={`flex h-10 items-center rounded-md px-4 text-sm font-bold ${
                pending?.danger ? "bg-danger text-ink hover:bg-danger/85" : "bg-hornet text-ink hover:bg-hornet-hover"
              }`}
            >
              {pending?.confirmLabel ?? "Yes"}
            </button>
          </>
        }
      >
        {pending && <div className="text-[15px] leading-relaxed text-sand">{pending.message}</div>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

/** Returns confirm(options) → Promise<boolean>. Falls back to the browser's prompt outside the admin. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  return useCallback(
    (options: ConfirmOptions) =>
      ctx ? ctx(options) : Promise.resolve(window.confirm(typeof options.message === "string" ? options.message : (options.title ?? "Are you sure?"))),
    [ctx],
  );
}

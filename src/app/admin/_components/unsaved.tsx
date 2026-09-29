"use client";

import {
  createContext,
  Fragment,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionState } from "@/lib/admin";
import { FormStatus } from "./action-form";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Entry = { save: () => Promise<ActionState>; revert: () => void; element: () => HTMLFormElement | null };

type Ctx = {
  dirtyCount: number;
  register: (id: string, entry: Entry) => () => void;
  setDirty: (id: string, dirty: boolean) => void;
  saveAll: () => void;
  nudge: () => void;
};

const UnsavedContext = createContext<Ctx | null>(null);

const GUARD = "__unsavedGuard";

/** Duplicates the current history entry (Next's router state included) with a marker. */
function pushGuard() {
  history.pushState({ ...history.state, [GUARD]: true }, "", location.href);
}

/**
 * Discord-style unsaved changes for the admin. Every EditForm on the page
 * reports whether it differs from what was loaded; while anything does, a bar
 * at the bottom offers Save (all forms at once) and Revert, and leaving the
 * page is blocked: the bar flashes red and shakes instead.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, Entry>());
  const [dirty, setDirtySet] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nudges, setNudges] = useState(0);
  const [alarm, setAlarm] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const alarmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirtyCount = dirty.size;
  const dirtyRef = useRef(dirtyCount);
  const savingRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirtyCount;
  }, [dirtyCount]);

  const register = useCallback((id: string, entry: Entry) => {
    entries.current.set(id, entry);
    return () => {
      entries.current.delete(id);
      setDirtySet((s) => {
        if (!s.has(id)) return s;
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    };
  }, []);

  const setDirty = useCallback((id: string, isDirty: boolean) => {
    setDirtySet((s) => {
      if (s.has(id) === isDirty) return s;
      const next = new Set(s);
      if (isDirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const saveAll = useCallback(() => {
    if (savingRef.current) return;
    const ids = [...dirty];
    if (ids.length === 0) return;
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    startTransition(async () => {
      let anyFailed = false;
      // One at a time, in page order, so a redirecting save runs last.
      const ordered = ids
        .map((id) => ({ id, entry: entries.current.get(id) }))
        .filter((x): x is { id: string; entry: Entry } => Boolean(x.entry))
        .sort((a, b) => {
          const ea = a.entry.element();
          const eb = b.entry.element();
          if (!ea || !eb) return 0;
          return ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
      for (const { entry } of ordered) {
        const result = await entry.save();
        if (!result.ok) anyFailed = true;
      }
      savingRef.current = false;
      setSaving(false);
      setFailed(anyFailed);
      if (anyFailed) {
        document.querySelector("[data-save-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        setSavedToast(true);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setSavedToast(false), 2200);
      }
    });
  }, [dirty]);

  const revertAll = useCallback(() => {
    for (const id of dirty) entries.current.get(id)?.revert();
    setFailed(false);
  }, [dirty]);

  // Flash the bar red and shake it; it calms down after a moment.
  const nudge = useCallback(() => {
    setNudges((n) => n + 1);
    setAlarm(true);
    clearTimeout(alarmTimer.current);
    alarmTimer.current = setTimeout(() => setAlarm(false), 1600);
  }, []);

  // ---- Block leaving the page while there are unsaved changes -------------
  useEffect(() => {
    if (dirtyCount === 0) return;

    // Links (sidebar, breadcrumbs, season picker…). Capture phase runs before
    // next/link's own click handler, so stopping here cancels the navigation.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, location.href);
      const samePage = url.origin === location.origin && url.pathname === location.pathname && url.search === location.search;
      if (samePage && url.hash) return;
      e.preventDefault();
      e.stopPropagation();
      nudge();
    }

    // Closing the tab or reloading: browsers only allow their own prompt here.
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirtyCount, nudge]);

  // Browser Back button. While dirty, an extra history entry for this same
  // page sits on top; Back lands on it (no navigation), and we put it back.
  const guardPushed = useRef(false);
  const skipPop = useRef(false);
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      if (skipPop.current) {
        skipPop.current = false;
        e.stopImmediatePropagation();
        return;
      }
      if (dirtyRef.current > 0 && guardPushed.current) {
        e.stopImmediatePropagation();
        pushGuard();
        nudge();
      }
    }
    // Capture listeners on window run before Next's router listener.
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, [nudge]);

  useEffect(() => {
    if (dirtyCount > 0 && !guardPushed.current) {
      guardPushed.current = true;
      pushGuard();
    } else if (dirtyCount === 0 && guardPushed.current) {
      guardPushed.current = false;
      // Only step back off the guard if we're still on it (a save that
      // redirected to another page has already moved on).
      if (history.state?.[GUARD]) {
        skipPop.current = true;
        history.back();
      }
    }
  }, [dirtyCount]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && dirtyRef.current > 0) {
        e.preventDefault();
        saveAll();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAll]);

  const value = useMemo(() => ({ dirtyCount, register, setDirty, saveAll, nudge }), [dirtyCount, register, setDirty, saveAll, nudge]);

  return (
    <UnsavedContext.Provider value={value}>
      {children}
      <SaveBar
        visible={dirtyCount > 0}
        saving={saving}
        failed={failed}
        alarm={alarm}
        nudges={nudges}
        onSave={saveAll}
        onRevert={revertAll}
      />
      {savedToast && dirtyCount === 0 && <SavedToast />}
    </UnsavedContext.Provider>
  );
}

function SaveBar({
  visible,
  saving,
  failed,
  alarm,
  nudges,
  onSave,
  onRevert,
}: {
  visible: boolean;
  saving: boolean;
  failed: boolean;
  alarm: boolean;
  nudges: number;
  onSave: () => void;
  onRevert: () => void;
}) {
  if (!visible) return null;
  const red = alarm || failed;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 lg:pl-[264px]">
      <div
        key={nudges}
        role="region"
        aria-label="Unsaved changes"
        className={`pointer-events-auto flex w-full max-w-[720px] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.55)] transition-colors duration-300 sm:flex-nowrap sm:py-2.5 sm:pl-5 ${
          red ? "border-danger bg-[#5c1712]" : "border-line-strong bg-raise"
        } ${alarm ? "motion-safe:animate-shake" : "animate-rise"}`}
      >
        <p className="text-[15px] font-semibold" aria-live="assertive">
          {failed
            ? "Some changes didn't save. Check the boxes marked in red."
            : alarm
              ? "Careful! Save your changes or revert them first."
              : "Save your changes"}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRevert}
            disabled={saving}
            className="flex h-10 items-center rounded-md px-3 text-sm font-semibold text-sand hover:text-bone hover:underline disabled:opacity-60"
          >
            Revert
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex h-10 items-center rounded-md bg-hornet px-5 text-sm font-bold text-ink hover:bg-hornet-hover disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SavedToast() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4 lg:pl-[264px]" role="status">
      <span className="animate-rise rounded-lg border border-line-strong bg-raise px-5 py-3 text-[15px] font-semibold shadow-[0_8px_32px_rgba(0,0,0,0.55)]">
        Changes saved
      </span>
    </div>
  );
}

/**
 * Whether any field differs from what the server rendered. Plain inputs keep
 * that in defaultValue / defaultChecked / defaultSelected, which React updates
 * whenever the page's data changes (after a save, a delete, a TBA reset…).
 * Widgets that control their own value (photo pickers, the Markdown editor)
 * put the saved value in data-default instead.
 */
function hasChanges(form: HTMLFormElement): boolean {
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
    if (el.disabled || !el.name) continue;
    const saved = el.dataset.default;
    if (saved !== undefined) {
      if (el.value !== saved) return true;
      continue;
    }
    if (el instanceof HTMLSelectElement) {
      const options = Array.from(el.options);
      if (el.multiple) {
        if (options.some((o) => o.selected !== o.defaultSelected)) return true;
      } else {
        // With no option marked, the browser shows the first one.
        const initial = Math.max(0, options.findIndex((o) => o.defaultSelected));
        if (el.selectedIndex !== initial) return true;
      }
    } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      if (el.checked !== el.defaultChecked) return true;
    } else if (el instanceof HTMLInputElement && (el.type === "file" || el.type === "submit" || el.type === "button")) {
      continue;
    } else if (el.value !== el.defaultValue) {
      return true;
    }
  }
  return false;
}

function adoptAsSaved(form: HTMLFormElement) {
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLSelectElement) {
      for (const o of Array.from(el.options)) o.defaultSelected = o.selected;
    } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      el.defaultChecked = el.checked;
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.dataset.default !== undefined) el.dataset.default = el.value;
      else if (el.type !== "file") el.defaultValue = el.value;
    }
  }
}

/**
 * A form that saves through the page's save bar instead of its own button.
 * Put the fields inside as usual; Enter in a text box or Ctrl+S saves every
 * changed form on the page, and Revert puts back what was loaded.
 */
export function EditForm({ action, children, className = "" }: { action: Action; children: ReactNode; className?: string }) {
  const ctx = useContext(UnsavedContext);
  if (!ctx) throw new Error("EditForm needs UnsavedChangesProvider (the admin layout has it).");
  const { register, setDirty, saveAll } = ctx;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ActionState>({ ok: false });

  const check = useCallback(() => {
    if (formRef.current) setDirty(id, hasChanges(formRef.current));
  }, [id, setDirty]);

  useEffect(
    () =>
      register(id, {
        element: () => formRef.current,
        save: async () => {
          const form = formRef.current;
          if (!form) return { ok: true };
          const result = await action({ ok: false }, new FormData(form));
          setState(result);
          if (result.ok) {
            // What's in the boxes is now what's saved. (If the server tidied a
            // value up, its new default arrives with the refresh and the
            // observer below shows it.)
            adoptAsSaved(form);
            setDirty(id, false);
          }
          return result;
        },
        revert: () => {
          setState({ ok: false });
          setVersion((v) => v + 1);
        },
      }),
    [action, id, register, setDirty],
  );

  // A new version remounts the fields, putting back the loaded values.
  useLayoutEffect(check, [version, check]);

  // When the server sends new defaults (after a save, or a value it tidied up
  // like adding https://), show them in the field. Also catches widgets that
  // change hidden inputs without input events.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const el = m.target instanceof Text ? m.target.parentElement : (m.target as Element);
        const field =
          el instanceof HTMLTextAreaElement
            ? el
            : m.type === "attributes" && m.attributeName === "value" && el instanceof HTMLInputElement && el.type !== "hidden"
              ? el
              : null;
        if (field && document.activeElement !== field && field.dataset.default === undefined) field.value = field.defaultValue;
      }
      check();
    });
    observer.observe(form, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["value", "checked", "selected", "data-default"],
    });
    return () => observer.disconnect();
  }, [check]);

  return (
    <form
      ref={formRef}
      className={`flex flex-col gap-4 ${className}`}
      onInput={check}
      onChange={check}
      onSubmit={(e) => {
        // Buttons with their own action (like "Reset to TBA") run as normal,
        // but React resets the whole form after them, so not over unsaved edits.
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        if (submitter?.hasAttribute("formaction")) {
          if (formRef.current && hasChanges(formRef.current)) {
            e.preventDefault();
            ctx.nudge();
          }
          return;
        }
        e.preventDefault();
        saveAll();
      }}
      noValidate
    >
      {/* Enter in a text box "clicks" the form's first submit button. Make
          that this one (save), not a Delete or Reset button further down. */}
      <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only">
        Save
      </button>
      <Fragment key={version}>{children}</Fragment>
      {state.error && (
        <div data-save-error className="rounded-md border border-danger/60 bg-danger/10 px-3 py-2">
          <FormStatus state={state} />
        </div>
      )}
    </form>
  );
}

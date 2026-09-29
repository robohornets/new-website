"use client";

import { usePathname } from "next/navigation";
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Close } from "@/components/icons";
import { GROUPS, GUIDES, guidesFor, type Guide } from "./guides";

type Mode = "page" | "all";
const HelpContext = createContext<{ open: (mode?: Mode) => void }>({ open: () => {} });

/** Lets any admin component open the Help panel (the dashboard's big button does). */
export function useHelp() {
  return useContext(HelpContext);
}

/** "**bold**" → <strong>bold</strong>, for button names in guide steps. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-bone">
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function GuideCard({ guide, defaultOpen }: { guide: Guide; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-md border border-line bg-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">
        {guide.title}
        <span aria-hidden="true" className="font-label text-dust group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-4 py-4 text-[15px] leading-relaxed text-sand">
        <ol className="flex flex-col gap-2.5">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-raise font-label text-xs text-hornet">
                {i + 1}
              </span>
              <span>
                <Rich text={s} />
              </span>
            </li>
          ))}
        </ol>
        {guide.tips?.map((t, i) => (
          <p key={i} className="rounded-md bg-rust px-3 py-2 text-sm text-sand">
            <span className="font-label text-xs font-bold text-hornet">TIP </span>
            <Rich text={t} />
          </p>
        ))}
      </div>
    </details>
  );
}

/**
 * The "? Help" button on every admin page and the panel it opens. The panel
 * starts with the guides for the current page, then lists every guide.
 */
export function HelpProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ open: boolean; mode: Mode }>({ open: false, mode: "page" });
  const [query, setQuery] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const here = useMemo(() => guidesFor(pathname), [pathname]);

  const open = (mode: Mode = "page") => {
    openerRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setState({ open: true, mode });
  };
  const close = () => {
    setState((s) => ({ ...s, open: false }));
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (state.open) closeRef.current?.focus();
  }, [state.open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? GUIDES.filter((g) => `${g.title} ${g.steps.join(" ")} ${g.tips?.join(" ") ?? ""}`.toLowerCase().includes(q))
    : null;
  const showPage = state.mode === "page" && !filtered && here.length > 0;

  return (
    <HelpContext.Provider value={{ open }}>
      {children}

      {state.open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close help" tabIndex={-1} onClick={close} className="absolute inset-0 bg-black/60" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="relative flex h-full w-full max-w-[520px] flex-col border-l border-line bg-ink shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 id="help-title" className="font-display text-3xl font-extrabold uppercase">
                Help &amp; how-to
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close help"
                className="flex size-11 items-center justify-center rounded-md border border-line-strong hover:border-bone"
              >
                <Close />
              </button>
            </div>
            <div className="border-b border-line px-5 py-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Search the guides
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. photo, sponsor, score"
                  className="h-11 rounded-md border border-edge bg-panel px-3 text-[15px] font-normal text-bone placeholder:text-ash focus:border-hornet focus:outline-none"
                />
              </label>
            </div>
            <div className="flex grow flex-col gap-6 overflow-y-auto px-5 py-5">
              {filtered ? (
                <section className="flex flex-col gap-2">
                  <h3 className="eyebrow text-xs text-ash">{filtered.length} matching guides</h3>
                  {filtered.map((g) => (
                    <GuideCard key={g.id} guide={g} />
                  ))}
                  {filtered.length === 0 && <p className="text-sm text-dust">Nothing matches. Try a different word.</p>}
                </section>
              ) : (
                <>
                  {showPage && (
                    <section className="flex flex-col gap-2">
                      <h3 className="eyebrow text-xs text-hornet">For this page</h3>
                      {here.map((g, i) => (
                        <GuideCard key={g.id} guide={g} defaultOpen={i === 0} />
                      ))}
                    </section>
                  )}
                  {GROUPS.map((group) => {
                    const list = GUIDES.filter((g) => g.group === group && !(showPage && here.includes(g)));
                    if (!list.length) return null;
                    return (
                      <section key={group} className="flex flex-col gap-2">
                        <h3 className="eyebrow text-xs text-ash">{group}</h3>
                        {list.map((g) => (
                          <GuideCard key={g.id} guide={g} defaultOpen={state.mode === "all" && g.id === "how-it-works"} />
                        ))}
                      </section>
                    );
                  })}
                </>
              )}
            </div>
            <p className="border-t border-line px-5 py-3 text-xs text-dust">
              Still stuck? Ask whoever set up the site, or check the README on GitHub.
            </p>
          </div>
        </div>
      )}
    </HelpContext.Provider>
  );
}

/** The "? Help" button at the top of every admin page. */
export function HelpButton() {
  const { open } = useHelp();
  return (
    <button
      type="button"
      onClick={() => open("page")}
      aria-haspopup="dialog"
      className="flex h-11 items-center gap-2 rounded-full border-2 border-hornet bg-rust pr-4 pl-1.5 font-bold text-bone hover:bg-hornet hover:text-ink"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-hornet font-display text-lg text-ink" aria-hidden="true">
        ?
      </span>
      Help for this page
    </button>
  );
}

/** The big "Need help?" card on the dashboard. */
export function HelpStartCard() {
  const { open } = useHelp();
  return (
    <button
      type="button"
      onClick={() => open("all")}
      className="flex w-full flex-col gap-4 rounded-md border-2 border-hornet bg-rust p-6 text-left hover:bg-raise sm:flex-row sm:items-center"
    >
      <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-hornet font-display text-4xl font-black text-ink" aria-hidden="true">
        ?
      </span>
      <span className="flex grow flex-col gap-1">
        <span className="font-display text-3xl leading-none font-extrabold uppercase">New here? Start with the help guides</span>
        <span className="text-[15px] text-sand">
          Step-by-step instructions for starting a season, fixing competition results, uploading photos, writing posts, and updating the
          roster and sponsors.
        </span>
      </span>
      <span className="flex h-12 shrink-0 items-center rounded-md bg-hornet px-5 font-bold text-ink">Open help</span>
    </button>
  );
}

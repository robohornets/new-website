"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { importYearFromTba, listTbaYears } from "../events/actions";

/** Imports every past season from The Blue Alliance, one year per request. */
export function HistoryImporter({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ year: number; ok: boolean; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setLog([]);
    const { years, error } = await listTbaYears();
    if (error) {
      setError(error);
      setBusy(false);
      return;
    }
    for (const year of years) {
      const res = await importYearFromTba(year);
      setLog((l) => [...l, { year, ...res }]);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        className="flex h-11 items-center self-start rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import all past seasons from TBA"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {log.length > 0 && (
        <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-line bg-ink p-3 font-label text-xs" role="status">
          {log.map((l) => (
            <li key={l.year} className={l.ok ? "text-sand" : "text-danger"}>
              {l.year}: {l.message}
            </li>
          ))}
          {!busy && <li className="text-hornet">Done. Safe to run again any time; it only fills in and updates.</li>}
        </ul>
      )}
    </div>
  );
}

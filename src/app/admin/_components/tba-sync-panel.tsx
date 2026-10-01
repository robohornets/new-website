import type { TbaStatus } from "@/lib/admin-data";
import { formatDateTime, seasonLabel } from "@/lib/format";
import { syncSeasonFromTba } from "../events/actions";
import { ActionButton } from "./action-form";

/** "Connected to The Blue Alliance" box with a Sync button and the last result. */
export function TbaSyncPanel({ year, status, connected }: { year: number; status: TbaStatus | null; connected: boolean }) {
  if (!connected) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border border-line-strong bg-ink p-4 text-sm">
        <span className="font-semibold">The Blue Alliance isn&apos;t connected yet</span>
        <span className="text-dust">
          Once the TBA API key is added (see the README), events, results and matches fill in automatically. Until then, add
          events by hand below.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line-strong bg-ink p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Connected to The Blue Alliance</span>
        <span className="text-dust">
          Updates on its own every 15 minutes during events and once a day otherwise.
          {status && (
            <>
              {" "}
              Last sync {formatDateTime(status.at)} ({status.trigger}):{" "}
              <span className={status.ok ? "text-sand" : "text-danger"}>{status.message}</span>
            </>
          )}
        </span>
      </div>
      <ActionButton action={syncSeasonFromTba.bind(null, year)} variant="primary">
        Sync {seasonLabel(year)} now
      </ActionButton>
    </div>
  );
}

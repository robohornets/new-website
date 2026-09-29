// Offline storage for /scouting: the last copy of everything this phone has
// looked at, plus a queue of changes waiting to upload. All in localStorage,
// so it survives closing the tab and works with no signal.

import type { ScoutEntry, TeamDetail } from "@/lib/scouting-data";
import type { ScoutingData, ScoutingValue } from "@/lib/scouting";

export type Op =
  | { op: "robot"; team: number; changes: Record<string, ScoutingValue | null>; scouter: string; at: string }
  | { op: "report"; clientId: string; team: number; eventKey: string | null; matchKey: string | null; data: ScoutingData; scouter: string; at: string }
  | { op: "delete"; clientId: string; team: number; scouter: string; at: string };

const PREFIX = "scout:";

export function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Full or blocked storage: the app still works online.
  }
}

/** A saved copy of an API response, with when it was fetched. */
export type Cached<T> = { at: string; data: T };

/**
 * GET from the scouting API, falling back to the saved copy when offline.
 * `fromCache` says the answer came from the phone, not the server.
 */
export async function load<T>(path: string, cacheKey: string): Promise<{ data: T; at: string; fromCache: boolean } | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok && res.status !== 403) throw new Error(String(res.status));
    const data = (await res.json()) as T;
    const at = new Date().toISOString();
    if (res.ok) write(cacheKey, { at, data } satisfies Cached<T>);
    return { data, at, fromCache: false };
  } catch {
    const cached = read<Cached<T>>(cacheKey);
    return cached ? { ...cached, fromCache: true } : null;
  }
}

// ---- The queue ------------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();
export function onQueueChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((fn) => fn());

export function getQueue(): Op[] {
  return read<Op[]>("queue") ?? [];
}

export function enqueue(op: Op) {
  const queue = getQueue();
  // A newer edit of the same report replaces the older one still waiting.
  const next =
    op.op === "report" || op.op === "delete"
      ? [...queue.filter((q) => !((q.op === "report" || q.op === "delete") && q.clientId === op.clientId)), op]
      : [...queue, op];
  write("queue", next);
  notify();
}

let syncing: Promise<SyncResult> | null = null;
export type SyncResult = { sent: number; failed: string[]; offline: boolean };

/** Uploads the queue. Changes the server refused are dropped and reported; network errors keep them. */
export function sync(): Promise<SyncResult> {
  if (!syncing) {
    syncing = upload().finally(() => {
      syncing = null;
    });
  }
  return syncing;
}

async function upload(): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: [], offline: false };
  // Keep going while there's more (50 at a time), including anything queued meanwhile.
  for (let round = 0; round < 20; round++) {
    const batch = getQueue().slice(0, 50);
    if (batch.length === 0) break;
    let res: Response;
    try {
      res = await fetch("/scouting/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ops: batch }),
      });
    } catch {
      result.offline = true;
      break;
    }
    // Busy or rate limited: leave it queued and try again later.
    if (res.status === 429 || res.status >= 500) break;
    const body = (await res.json().catch(() => ({}))) as { results?: { ok: boolean; error?: string }[]; error?: string };
    if (!res.ok) {
      // Closed, or the whole batch was refused: keep it for later.
      result.failed.push(body.error ?? "Couldn't upload.");
      break;
    }
    result.failed.push(...(body.results ?? []).filter((r) => !r.ok).map((r) => r.error ?? "Couldn't save one change."));
    const sent = new Set(batch.map((b) => JSON.stringify(b)));
    write(
      "queue",
      getQueue().filter((q) => !sent.has(JSON.stringify(q))),
    );
    result.sent += batch.length;
    notify();
  }
  return result;
}

// ---- Showing queued changes before they upload ---------------------------------------

/** Applies this phone's waiting changes to a team, so what you saved shows right away. */
export function withQueued(detail: TeamDetail, queue: Op[]): TeamDetail {
  let robot = detail.robot;
  let reports = [...detail.reports];
  for (const op of queue) {
    if (op.team !== detail.number) continue;
    if (op.op === "robot") {
      const data: ScoutingData = { ...(robot?.data ?? {}) };
      for (const [k, v] of Object.entries(op.changes)) {
        if (v === null) delete data[k];
        else data[k] = v;
      }
      robot = {
        clientId: robot?.clientId ?? "pending-robot",
        kind: "robot",
        team: op.team,
        eventKey: null,
        matchKey: null,
        data,
        scouter: op.scouter,
        createdAt: robot?.createdAt ?? op.at,
        updatedAt: op.at,
      };
    } else if (op.op === "report") {
      const existing = reports.find((r) => r.clientId === op.clientId);
      const entry: ScoutEntry = {
        clientId: op.clientId,
        kind: "report",
        team: op.team,
        eventKey: op.eventKey,
        matchKey: op.matchKey,
        data: op.data,
        scouter: op.scouter,
        createdAt: existing?.createdAt ?? op.at,
        updatedAt: op.at,
      };
      reports = existing ? reports.map((r) => (r.clientId === op.clientId ? entry : r)) : [entry, ...reports];
    } else if (op.op === "delete") {
      reports = reports.filter((r) => r.clientId !== op.clientId);
      if (robot?.clientId === op.clientId) robot = null;
    }
  }
  return { ...detail, robot, reports };
}

export function isPending(queue: Op[], clientId: string) {
  return queue.some((q) => (q.op === "report" || q.op === "delete") && q.clientId === clientId);
}

export function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---- The scout's name ------------------------------------------------------------------

const nameListeners = new Set<Listener>();
export function onNameChange(fn: Listener) {
  nameListeners.add(fn);
  return () => nameListeners.delete(fn);
}
export function getName(): string {
  return read<string>("name") ?? "";
}
export function setName(name: string) {
  write("name", name);
  nameListeners.forEach((fn) => fn());
}

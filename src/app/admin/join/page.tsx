import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { getCurrentSeason, getSettings, getSubteams } from "@/lib/data";
import { all, first, parseJson } from "@/lib/db";
import { formatDate, seasonLabel } from "@/lib/format";
import type { JoinRequest, JoinRequestStatus, Subteam } from "@/lib/types";
import { ActionButton } from "../_components/action-form";
import { ModalItem, RowContent } from "../_components/items";
import { AdminPageHeader, Checkbox, Panel, SelectField, TextField } from "../_components/fields";
import { EditForm } from "../_components/unsaved";
import { saveSettings } from "../settings/actions";
import { addJoinToRoster, clearJoinTab, declineJoin, deleteJoin, reopenJoin } from "./actions";
import { CopyLink } from "../_components/copy-link";

export const metadata: Metadata = { title: "Join requests" };

const TABS: { value: JoinRequestStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "added", label: "Added" },
  { value: "declined", label: "Declined" },
];

type Row = Omit<JoinRequest, "ranking"> & { ranking: string; person_name: string | null; subteam_name: string | null };

export default async function AdminJoinPage(props: PageProps<"/admin/join">) {
  await requireAdminPage();
  const { tab: tabParam, done, id: doneId } = await props.searchParams;
  const tab = TABS.find((t) => t.value === tabParam)?.value ?? "pending";

  const [settings, subteams, season, counts, rows] = await Promise.all([
    getSettings(),
    getSubteams(),
    getCurrentSeason(),
    all<{ status: JoinRequestStatus; n: number }>("SELECT status, COUNT(*) AS n FROM join_requests GROUP BY status"),
    all<Row>(
      `SELECT j.*, p.first_name || ' ' || p.last_name AS person_name, s.name AS subteam_name
       FROM join_requests j
       LEFT JOIN people p ON p.id = j.person_id
       LEFT JOIN subteams s ON s.id = j.assigned_subteam_id
       WHERE j.status = ?
       ORDER BY ${tab === "pending" ? "j.created_at" : "j.decided_at DESC"}`,
      tab,
    ),
  ]);
  const count = (s: JoinRequestStatus) => counts.find((c) => c.status === s)?.n ?? 0;
  const requests: (JoinRequest & { person_name: string | null; subteam_name: string | null })[] = rows.map((r) => ({
    ...r,
    ranking: parseJson(r.ranking, []),
  }));
  const open = settings.join_requests.open;
  const doneRequest =
    (done === "added" || done === "declined") && doneId
      ? await first<{ id: number; first_name: string; last_name: string; person_id: number | null; season_year: number | null; status: string }>(
          "SELECT id, first_name, last_name, person_id, season_year, status FROM join_requests WHERE id = ?",
          Number(doneId),
        )
      : null;

  return (
    <>
      <AdminPageHeader
        title="Join requests"
        description="Students ask to join with the form at /join. It isn't linked anywhere on the site, so share the link yourself (group chat, interest meeting slides)."
      />

      {doneRequest && doneRequest.status === done && (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line-strong bg-raise px-5 py-4">
          <span className="font-semibold">
            {done === "added"
              ? `${doneRequest.first_name} ${doneRequest.last_name} is on the ${seasonLabel(doneRequest.season_year)} roster.`
              : `Declined ${doneRequest.first_name} ${doneRequest.last_name}'s request.`}
          </span>
          {done === "added" && doneRequest.person_id && (
            <Link href={`/admin/people/${doneRequest.person_id}`} className="text-sm font-semibold text-hornet hover:text-hornet-hover">
              Edit their profile
            </Link>
          )}
          {done === "declined" && <ActionButton action={reopenJoin.bind(null, doneRequest.id)}>Undo</ActionButton>}
        </div>
      )}

      <Panel title="Join form">
        <EditForm action={saveSettings.bind(null, "join_requests")}>
          <div className="flex flex-wrap items-center gap-4">
            <Checkbox
              label="Accept join requests"
              name="open"
              defaultChecked={open}
              hint="While this is off, the form says requests are closed. Turn it off again once recruiting is done."
            />
            <span
              className={`rounded px-2.5 py-1 font-label text-xs font-bold tracking-wider ${open ? "bg-rust text-white" : "bg-raise text-dust"}`}
            >
              {open ? "OPEN" : "CLOSED"}
            </span>
          </div>
        </EditForm>
        <CopyLink path="/join" />
      </Panel>

      <nav aria-label="Request status" className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/join?tab=${t.value}`}
            aria-current={t.value === tab ? "page" : undefined}
            className={`flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold ${
              t.value === tab ? "bg-bone text-ink" : "border border-line-strong text-sand hover:border-bone"
            }`}
          >
            {t.label}
            <span className={`font-label text-xs ${t.value === tab ? "text-ink/70" : "text-ash"}`}>{count(t.value)}</span>
          </Link>
        ))}
      </nav>

      <Panel
        title={`${TABS.find((t) => t.value === tab)!.label} requests`}
        actions={
          tab !== "pending" && requests.length > 0 ? (
            <ActionButton
              action={clearJoinTab.bind(null, tab)}
              variant="danger"
              confirm={`Delete every ${tab} request? ${tab === "added" ? "The people stay on the roster." : ""}`}
            >
              Clear this tab
            </ActionButton>
          ) : undefined
        }
      >
        {requests.length === 0 ? (
          <p className="text-sm text-dust">
            {tab === "pending" ? (open ? "No requests waiting. New ones show up here." : "No requests waiting. The form is closed.") : `No ${tab} requests.`}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {requests.map((r) => (
              <RequestItem key={r.id} request={r} subteams={subteams} seasonYear={season?.year ?? null} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function RequestItem({
  request: r,
  subteams,
  seasonYear,
}: {
  request: JoinRequest & { person_name: string | null; subteam_name: string | null };
  subteams: Subteam[];
  seasonYear: number | null;
}) {
  const nameFor = (pick: { id: number; name: string }) => subteams.find((s) => s.id === pick.id)?.name ?? `${pick.name} (deleted)`;
  const firstPick = r.ranking[0];
  const subteamOptions = [
    { value: "", label: "No subteam" },
    ...subteams.map((s) => ({ value: s.id, label: s.private ? `${s.name} (private)` : s.name })),
  ];
  const name = `${r.first_name} ${r.last_name}`;
  const status =
    r.status === "pending"
      ? firstPick
        ? `1st choice: ${nameFor(firstPick)}`
        : "No subteams ranked"
      : r.status === "added"
        ? `Added${r.subteam_name ? ` to ${r.subteam_name}` : ""}${r.season_year ? `, ${seasonLabel(r.season_year)} roster` : ""}`
        : `Declined ${formatDate(r.decided_at)}`;

  const details = (
    <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
      <div className="flex flex-col gap-2">
        <h3 className="eyebrow text-[11px] text-ash">Their ranking</h3>
        {r.ranking.length ? (
          <ol className="flex flex-col gap-1">
            {r.ranking.map((pick, i) => (
              <li key={pick.id} className="flex items-baseline gap-3 text-sm">
                <span className="w-5 font-label font-bold text-hornet">{i + 1}</span>
                {nameFor(pick)}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-dust">No subteams ranked.</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="eyebrow text-[11px] text-ash">About them</h3>
        <p className="text-[15px] leading-relaxed whitespace-pre-line text-sand">{r.about || "They didn't write anything."}</p>
      </div>
    </div>
  );

  const row = <RowContent opens="popup" title={name} meta={`Class of ${r.graduation_year} · ${status} · sent ${formatDate(r.created_at)}`} />;

  if (r.status === "pending") {
    return (
      <ModalItem
        row={row}
        title={name}
        description={`Class of ${r.graduation_year} · sent ${formatDate(r.created_at)}`}
        size="lg"
        action={addJoinToRoster.bind(null, r.id)}
        submitLabel={seasonYear ? `Add to ${seasonLabel(seasonYear)} roster` : "Add to roster"}
        destroy={{ label: "Decline", confirm: `Decline ${r.first_name}'s request? You can move it back to Pending later.`, action: declineJoin.bind(null, r.id) }}
      >
        {details}
        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <SelectField label="Subteam" name="subteam_id" defaultValue={r.assigned_subteam_id ?? ""} options={subteamOptions} hint="Starts as their 1st choice. They never see this." />
          <TextField label="Role" name="role" defaultValue="Member" />
        </div>
      </ModalItem>
    );
  }
  return (
    <ModalItem
      row={row}
      title={name}
      description={`Class of ${r.graduation_year} · ${r.status === "added" ? "added" : "declined"} by ${r.decided_by} on ${formatDate(r.decided_at)}`}
      size="lg"
      footer={
        r.status === "declined" ? (
          <>
            <span className="mr-auto">
              <ActionButton action={deleteJoin.bind(null, r.id)} variant="danger" confirm="Delete this request for good?">
                Delete request
              </ActionButton>
            </span>
            <ActionButton action={reopenJoin.bind(null, r.id)}>Move back to Pending</ActionButton>
          </>
        ) : r.person_id ? (
          <Link href={`/admin/people/${r.person_id}`} className="mr-auto text-sm font-semibold text-hornet hover:text-hornet-hover">
            Edit {r.person_name ?? "their profile"}
          </Link>
        ) : undefined
      }
    >
      {details}
    </ModalItem>
  );
}

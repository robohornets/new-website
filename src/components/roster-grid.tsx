import { canShowPhoto, displayName } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import type { RosterMember, Subteam } from "@/lib/types";
import { MemberCard, type PublicMember } from "./member-card";

/** Cut a roster entry down to what the public site shows. Runs on the server. */
function toPublic(m: RosterMember): PublicMember {
  const name = displayName(m);
  return {
    key: m.entry_id,
    name,
    initials: `${m.first_name.trim()[0] ?? ""}${m.last_name.trim()[0] ?? ""}`.toUpperCase() || "?",
    photo: canShowPhoto(m) ? mediaUrl(m.photo_key, 320) : null,
    role: m.role,
    subteam: m.subteam,
    bio: m.bio.trim(),
    kind: m.kind,
    leadership: m.is_leadership === 1,
  };
}

function Cards({ members, showSubteam }: { members: PublicMember[]; showSubteam?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {members.map((m) => (
        <li key={m.key} className="min-w-0">
          <MemberCard member={m} showSubteam={showSubteam} />
        </li>
      ))}
    </ul>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="flex items-baseline gap-3">
        <span className="eyebrow text-bone">{title}</span>
        <span className="font-label text-xs text-ash">{count}</span>
      </h3>
      {children}
    </section>
  );
}

/**
 * Everyone as compact cards: their photo when it may be shown, otherwise
 * their initials on a brand-colored badge, so nobody is an empty box.
 *
 * `subteams` groups students: Leadership first, then each subteam (in the
 * admin's order) with people under their main subteam, then anyone without
 * one. Without it, it's one list (used for mentors).
 */
export function RosterGrid({ members, subteams }: { members: RosterMember[]; subteams?: Subteam[] }) {
  if (!subteams) return <Cards members={members.map(toPublic)} />;

  // In a subteam's own section, "Member" under every name is just noise.
  const quiet = (m: RosterMember) => ({ ...toPublic(m), role: m.role === "Member" ? "" : m.role });
  const leaders = members.filter((m) => m.is_leadership === 1);
  const rest = members.filter((m) => m.is_leadership !== 1);
  const groups = subteams
    .map((s) => ({ title: s.name, members: rest.filter((m) => m.subteam_id === s.id) }))
    .filter((g) => g.members.length > 0);
  const unassigned = rest.filter((m) => m.subteam_id === null || !subteams.some((s) => s.id === m.subteam_id));

  return (
    <div className="flex flex-col gap-10">
      {leaders.length > 0 && (
        <Group title="Leadership" count={leaders.length}>
          <Cards members={leaders.map(quiet)} showSubteam />
        </Group>
      )}
      {groups.map((g) => (
        <Group key={g.title} title={g.title} count={g.members.length}>
          <Cards members={g.members.map(quiet)} />
        </Group>
      ))}
      {unassigned.length > 0 && (
        <Group title={groups.length > 0 || leaders.length > 0 ? "More members" : "Members"} count={unassigned.length}>
          <Cards members={unassigned.map(quiet)} />
        </Group>
      )}
    </div>
  );
}

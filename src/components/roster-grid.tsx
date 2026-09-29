import { canShowPhoto, displayName } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import type { RosterMember } from "@/lib/types";

export function RosterGrid({ members }: { members: RosterMember[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {members.map((m) => {
        const photo = canShowPhoto(m) ? mediaUrl(m.photo_key, 320) : null;
        const roleColor = m.kind === "mentor" ? "text-mentor" : m.is_leadership ? "text-hornet" : "text-dust";
        return (
          <li key={m.entry_id} className="flex flex-col gap-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-line bg-panel">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <svg width="30" height="34" viewBox="0 0 60 68" aria-hidden="true">
                  <polygon points="30,2 58,18 58,50 30,66 2,50 2,18" fill="none" stroke="#4a443b" strokeWidth="2" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{displayName(m)}</span>
              <span className={`text-[13px] ${roleColor}`}>
                {m.role}
                {m.subteam && m.subteam !== m.role ? ` · ${m.subteam}` : ""}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

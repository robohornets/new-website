import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { MESSAGE_TOPICS, type Message } from "@/lib/types";
import { ActionButton } from "../_components/action-form";
import { AdminPageHeader } from "../_components/fields";
import { deleteMessage, setArchived, setRead } from "./actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Messages" };

export default async function AdminMessagesPage(props: PageProps<"/admin/messages">) {
  await requireAdminPage();
  const { view } = await props.searchParams;
  const archived = view === "archived";
  const messages = await all<Message>(
    "SELECT * FROM messages WHERE archived = ? ORDER BY created_at DESC LIMIT 200",
    archived ? 1 : 0,
  );
  const topicLabel = new Map(MESSAGE_TOPICS.map((t) => [t.value, t.label]));

  return (
    <>
      <AdminPageHeader title="Messages" description="Everything sent through the contact form. Reply by email; the address is in each message." />
      <nav aria-label="Folders" className="flex gap-2">
        {[
          { href: "/admin/messages", label: "Inbox", active: !archived },
          { href: "/admin/messages?view=archived", label: "Archived", active: archived },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`flex h-10 items-center rounded-full px-4 text-sm font-semibold ${
              t.active ? "bg-bone text-ink" : "border border-line-strong text-sand hover:border-bone"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {messages.length === 0 ? (
        <p className="rounded-md border border-line bg-panel p-8 text-dust">{archived ? "Nothing archived." : "No messages. Inbox zero!"}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} id={`m${m.id}`} className={`rounded-md border bg-panel ${m.read_at ? "border-line" : "border-hornet/60"}`}>
              <div className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-3">
                    {!m.read_at && <span className="size-2 rounded-full bg-hornet" aria-label="Unread" />}
                    <span className="font-semibold">{m.name}</span>
                    <a href={`mailto:${m.email}`} className="font-mono text-sm text-hornet hover:text-amber">
                      {m.email}
                    </a>
                    <span className="rounded border border-line-strong px-2 py-0.5 font-mono text-[11px] text-sand uppercase">
                      {topicLabel.get(m.topic) ?? m.topic}
                    </span>
                  </div>
                  <span className="text-[13px] text-ash">{formatDateTime(m.created_at)}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-line text-sand">{m.body}</p>
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to the RoboHornets")}`}
                    className="flex h-10 items-center rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-amber"
                  >
                    Reply
                  </a>
                  <ActionButton action={setRead.bind(null, m.id, !m.read_at)}>{m.read_at ? "Mark unread" : "Mark read"}</ActionButton>
                  <ActionButton action={setArchived.bind(null, m.id, !archived)}>{archived ? "Move to inbox" : "Archive"}</ActionButton>
                  <ActionButton action={deleteMessage.bind(null, m.id)} variant="danger" confirm="Delete this message for good?">
                    Delete
                  </ActionButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

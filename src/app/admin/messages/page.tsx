import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { MESSAGE_TOPICS, type Message } from "@/lib/types";
import { ActionButton } from "../_components/action-form";
import { ModalItem, RowContent } from "../_components/items";
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
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <ModalItem
              key={m.id}
              title={m.name}
              description={`${topicLabel.get(m.topic) ?? m.topic} · ${formatDateTime(m.created_at)}`}
              size="lg"
              onOpen={m.read_at ? undefined : setRead.bind(null, m.id, true)}
              row={
                <RowContent
                  opens="popup"
                  media={<span className={`block size-2.5 rounded-full ${m.read_at ? "bg-transparent" : "bg-hornet"}`} aria-label={m.read_at ? undefined : "Unread"} />}
                  title={
                    <>
                      {m.name} <span className="font-normal text-dust">· {m.body.slice(0, 90)}</span>
                    </>
                  }
                  meta={`${topicLabel.get(m.topic) ?? m.topic} · ${formatDateTime(m.created_at)}`}
                />
              }
              footer={
                <>
                  <span className="mr-auto">
                    <ActionButton action={deleteMessage.bind(null, m.id)} variant="danger" confirm="Delete this message for good?">
                      Delete
                    </ActionButton>
                  </span>
                  <ActionButton action={setRead.bind(null, m.id, false)}>Mark unread</ActionButton>
                  <ActionButton action={setArchived.bind(null, m.id, !archived)}>{archived ? "Move to inbox" : "Archive"}</ActionButton>
                  <a
                    href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message to the RoboHornets")}`}
                    className="flex h-10 items-center rounded-md bg-hornet px-4 text-sm font-bold text-ink hover:bg-hornet-hover"
                  >
                    Reply
                  </a>
                </>
              }
            >
              <p className="flex flex-wrap items-baseline gap-3">
                <a href={`mailto:${m.email}`} className="font-label text-sm text-hornet hover:text-hornet-hover">
                  {m.email}
                </a>
              </p>
              <p className="text-[15px] leading-relaxed whitespace-pre-line text-sand">{m.body}</p>
            </ModalItem>
          ))}
        </div>
      )}
    </>
  );
}

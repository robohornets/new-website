"use client";

import { useActionState } from "react";
import { MESSAGE_TOPICS, type MessageTopic } from "@/lib/types";
import { sendMessage, type ContactState } from "./actions";

const input =
  "h-12 w-full rounded-md border border-edge bg-ink px-3.5 text-base text-bone placeholder:text-ash focus:border-hornet focus:outline-none";

export function ContactForm({ defaultTopic }: { defaultTopic: MessageTopic }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendMessage, { ok: false });

  if (state.ok) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-line bg-panel p-8" role="status">
        <h2 className="font-display text-4xl font-extrabold text-hornet uppercase">Message sent</h2>
        <p className="text-sand">Thanks for reaching out. Someone from the team will get back to you soon.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5 rounded-md border border-line bg-panel p-6 md:p-8" noValidate>
      <h2 className="font-display text-4xl font-extrabold uppercase">Message us</h2>
      {state.error && (
        <p role="alert" className="rounded-md border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-bone">
          {state.error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" error={state.fieldErrors?.name}>
          <input name="name" autoComplete="name" required className={input} aria-invalid={Boolean(state.fieldErrors?.name)} />
        </Field>
        <Field label="Email" error={state.fieldErrors?.email}>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className={input}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
        </Field>
      </div>
      <Field label="What's this about?">
        <select name="topic" defaultValue={defaultTopic} className={input}>
          {MESSAGE_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Message" error={state.fieldErrors?.body}>
        <textarea
          name="body"
          rows={6}
          required
          className={`${input} h-auto py-3`}
          aria-invalid={Boolean(state.fieldErrors?.body)}
        />
      </Field>
      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex h-13 items-center justify-center self-start rounded-md bg-hornet px-7 font-bold text-ink hover:bg-amber disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold">
      {label}
      {children}
      {error && <span className="text-sm font-normal text-danger">{error}</span>}
    </label>
  );
}

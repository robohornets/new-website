import type { Metadata } from "next";
import { Mail, MapPin, SOCIAL_LABEL, SocialIcon } from "@/components/icons";
import { Container, PageHeader } from "@/components/page-header";
import { getContacts, getSettings } from "@/lib/data";
import { MESSAGE_TOPICS, type MessageTopic } from "@/lib/types";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the RoboHornets about sponsoring, donating, mentoring or joining.",
};

export default async function ContactPage(props: PageProps<"/contact">) {
  const { topic } = await props.searchParams;
  const topicValue = Array.isArray(topic) ? topic[0] : topic;
  const defaultTopic: MessageTopic = MESSAGE_TOPICS.some((t) => t.value === topicValue) ? (topicValue as MessageTopic) : "other";
  const [settings, contacts] = await Promise.all([getSettings(), getContacts()]);
  const { contact, socials } = settings;

  return (
    <>
      <PageHeader label="Contact" title="Get in touch" intro={<p>{contact.intro}</p>} />
      <Container className="grid gap-10 py-16 md:py-24 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
        <div className="flex flex-col gap-10">
          {contacts.length > 0 && (
            <ul className="flex flex-col gap-4">
              {contacts.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 border-b border-line pb-4">
                  <span className="text-lg font-semibold">{c.name}</span>
                  {c.role && <span className="text-sm text-dust">{c.role}</span>}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-2 font-mono text-[15px] text-hornet hover:text-amber">
                      <Mail size={16} /> {c.email}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          {contact.address && (
            <div className="flex gap-3 text-sand">
              <MapPin className="mt-1 shrink-0 text-hornet" />
              <p className="leading-relaxed whitespace-pre-line">
                {contact.mapsUrl ? (
                  <a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-bone">
                    {contact.address}
                  </a>
                ) : (
                  contact.address
                )}
              </p>
            </div>
          )}
          {socials.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="eyebrow text-xs text-ash">Follow along</h2>
              <ul className="flex flex-wrap gap-3">
                {socials.map((s) => (
                  <li key={s.platform + s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-11 items-center gap-2.5 rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-hornet hover:text-hornet"
                    >
                      <SocialIcon platform={s.platform} size={18} />
                      {SOCIAL_LABEL[s.platform] ?? s.platform}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <ContactForm defaultTopic={defaultTopic} />
      </Container>
    </>
  );
}

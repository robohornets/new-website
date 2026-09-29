import type { Metadata } from "next";
import { SOCIAL_LABEL } from "@/components/icons";
import { getContacts, getMediaFile, getSettings } from "@/lib/data";
import type { SocialPlatform } from "@/lib/types";
import { ActionButton, ActionForm } from "../_components/action-form";
import { EditForm } from "../_components/unsaved";
import { DocumentField } from "../_components/document-field";
import { AdminPageHeader, Grid, Panel, TextArea, TextField } from "../_components/fields";
import { createContact, deleteContact, saveSettings, updateContact } from "./actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Site text & links" };

const PLATFORMS: SocialPlatform[] = ["youtube", "instagram", "tiktok", "x", "github", "facebook", "threads"];

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const [s, contacts] = await Promise.all([getSettings(), getContacts()]);
  const planFile = await getMediaFile(s.strategic_plan.media_id);
  // Room for the six FIRST Core Values plus two more.
  const values = [...s.values, ...Array.from({ length: Math.max(0, 8 - s.values.length) }, () => ({ title: "", body: "" }))].slice(0, 8);
  const steps = [...s.build_steps, ...Array.from({ length: Math.max(0, 4 - s.build_steps.length) }, () => ({ title: "", when: "", body: "" }))].slice(0, 4);

  return (
    <>
      <AdminPageHeader title="Site text & links" description="The words on the homepage, Team, Contact and footer, plus the mission, values and Strategic Plan." />

      <Panel title="Homepage hero">
        <EditForm action={saveSettings.bind(null, "hero")}>
          <TextField label="Small line above the title" name="eyebrow" defaultValue={s.hero.eyebrow} />
          <Grid>
            <TextField label="Title, first part (white)" name="titleTop" defaultValue={s.hero.titleTop} />
            <TextField label="Title, second part (orange)" name="titleBottom" defaultValue={s.hero.titleBottom} />
          </Grid>
          <TextArea label="Intro" name="intro" rows={3} defaultValue={s.hero.intro} />
          <p className="text-xs text-dust">The hero photo comes from the current season&apos;s &quot;Season photo&quot;, set under Seasons.</p>
        </EditForm>
      </Panel>

      <Grid>
        <Panel title="Stats strip" description="Up to four, one per line as: value | label">
          <EditForm action={saveSettings.bind(null, "stats")}>
            <TextArea label="Stats" name="stats" rows={4} mono defaultValue={s.stats.map((x) => `${x.value} | ${x.label}`).join("\n")} />
          </EditForm>
        </Panel>
        <Panel title="Join the team box">
          <EditForm action={saveSettings.bind(null, "join")}>
            <TextField label="Heading" name="heading" defaultValue={s.join.heading} />
            <TextArea label="Text" name="body" rows={3} defaultValue={s.join.body} />
          </EditForm>
        </Panel>
      </Grid>

      <Panel title="About the team">
        <EditForm action={saveSettings.bind(null, "about")}>
          <TextField label="Heading" name="heading" defaultValue={s.about.heading} />
          <TextArea label="Short version" name="body" rows={3} defaultValue={s.about.body} hint="Homepage and the top of the Team page." />
          <TextArea label="Long version" name="long" rows={8} defaultValue={s.about.long} hint="Team page. Leave a blank line between paragraphs." />
        </EditForm>
      </Panel>

      <Panel title="Mission" description="The mission statement at the top of the Team page.">
        <EditForm action={saveSettings.bind(null, "mission")}>
          <TextArea label="Mission statement" name="mission" rows={3} defaultValue={s.mission} hint="Leave blank to hide it." />
        </EditForm>
      </Panel>

      <Panel title="Values" description="The numbered cards under the mission on the Team page. Leave a name blank to hide that card.">
        <EditForm action={saveSettings.bind(null, "values")}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {values.map((v, i) => (
              <fieldset key={i} className="flex flex-col gap-3 rounded-md border border-line p-4">
                <legend className="px-1 font-label text-xs text-dust">VALUE {String(i + 1).padStart(2, "0")}</legend>
                <TextField label="Name" name={`title_${i}`} defaultValue={v.title} placeholder="Teamwork" />
                <TextArea label="Text" name={`body_${i}`} rows={2} defaultValue={v.body} />
              </fieldset>
            ))}
          </div>
        </EditForm>
      </Panel>

      <Panel title="Strategic Plan" description="Shown on the Team page with a button to read the full plan.">
        <EditForm action={saveSettings.bind(null, "strategic_plan")}>
          <TextArea label="Short summary" name="summary" rows={3} defaultValue={s.strategic_plan.summary} hint="A sentence or two about what the plan covers." />
          <TextField label="Last updated" name="updated" defaultValue={s.strategic_plan.updated} placeholder="Fall 2026" hint="Optional. Shown next to the button." />
          <DocumentField
            name="plan"
            label="The plan"
            current={planFile}
            currentUrl={s.strategic_plan.url || null}
            hint="Upload the PDF, or paste a link to it (for example a Google Drive link set to “Anyone with the link”). Leave both empty to hide this section."
          />
        </EditForm>
      </Panel>

      <Panel title="How a season works" description="The numbered steps on the homepage and Team page. Leave a title blank to hide that step.">
        <EditForm action={saveSettings.bind(null, "build_steps")}>
          <div className="grid gap-4 lg:grid-cols-2">
            {steps.map((step, i) => (
              <fieldset key={i} className="flex flex-col gap-3 rounded-md border border-line p-4">
                <legend className="px-1 font-label text-xs text-dust">STEP {i + 1}</legend>
                <Grid>
                  <TextField label="Title" name={`title_${i}`} defaultValue={step.title} />
                  <TextField label="When" name={`when_${i}`} defaultValue={step.when} placeholder="Early Jan" />
                </Grid>
                <TextArea label="Text" name={`body_${i}`} rows={2} defaultValue={step.body} />
              </fieldset>
            ))}
          </div>
        </EditForm>
      </Panel>

      <Grid>
        <Panel title="Contact details">
          <EditForm action={saveSettings.bind(null, "contact")}>
            <TextField label="Team email" name="email" type="email" defaultValue={s.contact.email} />
            <TextArea label="Address" name="address" rows={2} defaultValue={s.contact.address} />
            <TextField label="Map link" name="mapsUrl" type="url" defaultValue={s.contact.mapsUrl} />
            <TextArea label="Contact page intro" name="intro" rows={2} defaultValue={s.contact.intro} />
          </EditForm>
        </Panel>
        <Panel title="Social media" description="Leave blank to hide.">
          <EditForm action={saveSettings.bind(null, "socials")}>
            {PLATFORMS.map((p) => (
              <TextField key={p} label={SOCIAL_LABEL[p]} name={p} type="url" defaultValue={s.socials.find((x) => x.platform === p)?.url} />
            ))}
          </EditForm>
        </Panel>
      </Grid>

      <Grid>
        <Panel title="Footer links" description="One per line as: Label | https://…">
          <EditForm action={saveSettings.bind(null, "friend_links")}>
            <TextArea label="Links" name="links" rows={4} mono defaultValue={s.friend_links.map((l) => `${l.label} | ${l.url}`).join("\n")} />
          </EditForm>
        </Panel>
        <Panel title="Donations" description="A link to your donation page (booster club, school foundation, etc.). Leave blank to hide the Donate button.">
          <EditForm action={saveSettings.bind(null, "donate_url")}>
            <TextField label="Donate link" name="donate_url" type="url" defaultValue={s.donate_url} />
          </EditForm>
        </Panel>
      </Grid>

      <Panel title="People on the Contact page">
        <ul className="flex flex-col divide-y divide-line">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-end">
              <EditForm action={updateContact.bind(null, c.id)} className="grow">
                <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_80px]">
                  <TextField label="Name" name="name" defaultValue={c.name} />
                  <TextField label="Role" name="role" defaultValue={c.role} />
                  <TextField label="Email" name="email" type="email" defaultValue={c.email} />
                  <TextField label="Order" name="sort_order" type="number" defaultValue={c.sort_order} />
                </div>
              </EditForm>
              <ActionButton action={deleteContact.bind(null, c.id)} variant="danger" confirm={`Remove ${c.name}?`}>
                Remove
              </ActionButton>
            </li>
          ))}
        </ul>
        <ActionForm action={createContact} submitLabel="Add person" submitVariant="secondary" resetOnSuccess>
          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_80px]">
            <TextField label="Name" name="name" />
            <TextField label="Role" name="role" placeholder="Booster Club Treasurer" />
            <TextField label="Email" name="email" type="email" />
            <TextField label="Order" name="sort_order" type="number" defaultValue={contacts.length} />
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}

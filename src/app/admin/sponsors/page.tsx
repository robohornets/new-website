import type { Metadata } from "next";
import { resolveSeasonParam } from "@/lib/admin-data";
import { specsToText } from "@/lib/admin";
import { getSettings, getSponsorTiers } from "@/lib/data";
import { all } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { SPONSOR_LOGO_SIZES, type Sponsor, type SponsorTier } from "@/lib/types";
import { AddButton, Badge, ModalItem, RowContent } from "../_components/items";
import { EditForm } from "../_components/unsaved";
import { AdminPageHeader, Grid, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { MediaField } from "../_components/media-field";
import { SeasonPicker } from "../_components/season-picker";
import { saveSettings } from "../settings/actions";
import { createSponsor, createTier, deleteSponsor, deleteTier, updateSponsor, updateTier } from "./actions";
import { requireAdminPage } from "@/lib/auth";
import { seasonLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Sponsors" };

export default async function AdminSponsorsPage(props: PageProps<"/admin/sponsors">) {
  await requireAdminPage();
  const { season } = await props.searchParams;
  const { year, years } = await resolveSeasonParam(season);
  const [sponsors, tiers, settings, lineup] = await Promise.all([
    all<Sponsor>("SELECT s.*, m.r2_key AS logo_key FROM sponsors s LEFT JOIN media m ON m.id = s.logo_media_id ORDER BY s.name"),
    getSponsorTiers(),
    getSettings(),
    year
      ? all<{ sponsor_id: number; tier_id: number; sort_order: number }>(
          "SELECT sponsor_id, tier_id, sort_order FROM sponsor_seasons WHERE season_year = ?",
          year,
        )
      : [],
  ]);
  const bySponsor = new Map(lineup.map((l) => [l.sponsor_id, l]));
  const tierOptions = tiers.map((t) => ({ value: t.id, label: t.name }));
  const tierById = new Map(tiers.map((t, i) => [t.id, { ...t, order: i }]));
  // This season's sponsors first, in the order the site shows them (tier, then
  // their order within it); everyone else after, by name.
  const place = (s: Sponsor) => {
    const l = bySponsor.get(s.id);
    const tier = l ? tierById.get(l.tier_id) : undefined;
    return tier ? [0, tier.order, l!.sort_order] : [1, 0, 0];
  };
  const listed = [...sponsors].sort((a, b) => {
    const [pa, pb] = [place(a), place(b)];
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2] || a.name.localeCompare(b.name);
  });

  return (
    <>
      <AdminPageHeader
        title="Sponsors"
        description="Sponsors are saved once and given a tier for each season they support (click a sponsor to change it). The public site shows the current season's sponsors."
      />
      <SeasonPicker basePath="/admin/sponsors" years={years} current={year} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Sponsors"
            description={year ? `Tiers shown are for ${seasonLabel(year)}. Pick another season at the top to see or change its tiers.` : undefined}
            actions={
              <AddButton label="Add sponsor" title="Add a sponsor" action={createSponsor.bind(null, year)} size="lg">
                {year && tiers.length > 0 && (
                  <SelectField label={`${seasonLabel(year)} tier`} name="tier_id" options={[{ value: "", label: "Not this season" }, ...tierOptions]} />
                )}
                <SponsorFields />
              </AddButton>
            }
          >
            {sponsors.length === 0 && <p className="text-sm text-dust">No sponsors yet. Add one with the button above.</p>}
            <div className="flex flex-col gap-2">
              {listed.map((s) => {
                const current = bySponsor.get(s.id);
                const tier = current ? tierById.get(current.tier_id) : undefined;
                return (
                  <ModalItem
                    key={s.id}
                    title={s.name}
                    size="lg"
                    action={updateSponsor.bind(null, s.id, year)}
                    destroy={{ label: "Delete sponsor", confirm: `Delete ${s.name} from every season?`, action: deleteSponsor.bind(null, s.id) }}
                    row={
                      <RowContent
                        opens="popup"
                        media={
                          <span className="flex h-10 w-20 items-center justify-center overflow-hidden rounded bg-bone">
                            {s.logo_key ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={mediaUrl(s.logo_key, 320) ?? ""} alt="" className="max-h-8 max-w-[72px] object-contain" />
                            ) : (
                              <span className="font-label text-[10px] text-ink/60">NO LOGO</span>
                            )}
                          </span>
                        }
                        title={s.name}
                        meta={s.url ?? undefined}
                        badges={year ? tier ? <Badge>{tier.name}</Badge> : <span className="font-label text-xs text-ash">Not in {seasonLabel(year)}</span> : undefined}
                      />
                    }
                  >
                    {year && tiers.length > 0 && (
                      <Grid>
                        <SelectField
                          label={`${seasonLabel(year)} tier`}
                          name="tier_id"
                          defaultValue={current?.tier_id ?? ""}
                          options={[{ value: "", label: "Not this season" }, ...tierOptions]}
                        />
                        <TextField label="Order within tier" name="sort_order" type="number" defaultValue={current?.sort_order ?? 0} hint="Lower shows first." />
                      </Grid>
                    )}
                    <SponsorFields sponsor={s} />
                  </ModalItem>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Settings before the list: beside it on wide screens, above it otherwise. */}
        <div className="order-first flex min-w-0 flex-col gap-6 xl:order-none">
          <Panel
            title="Tiers"
            description="The sponsorship levels, top first. Click one to change its amount, what it pays for and what sponsors get."
            actions={
              <AddButton label="Add tier" title="Add a tier" action={createTier} size="lg">
                <TierFields rank={tiers.length} />
              </AddButton>
            }
          >
            <div className="flex flex-col gap-2">
              {tiers.map((t) => (
                <ModalItem
                  key={t.id}
                  title={t.name}
                  size="lg"
                  action={updateTier.bind(null, t.id)}
                  destroy={{ label: "Delete tier", confirm: `Delete the ${t.name} tier?`, action: deleteTier.bind(null, t.id) }}
                  row={
                    <RowContent
                      opens="popup"
                      title={t.name}
                      meta={t.amount || "Not on the levels table"}
                      badges={<Badge tone="muted">{SPONSOR_LOGO_SIZES.find((s) => s.value === t.logo_size)?.label}</Badge>}
                    />
                  }
                >
                  <TierFields tier={t} />
                </ModalItem>
              ))}
            </div>
          </Panel>
          <Panel title="Other ways to help" description="Gifts that aren't money, listed on the Sponsors page. One per line. Leave empty to hide the list.">
            <EditForm action={saveSettings.bind(null, "sponsor_in_kind")}>
              <TextArea label="Gifts that aren't money" name="items" rows={7} defaultValue={settings.sponsor_in_kind.join("\n")} />
            </EditForm>
          </Panel>
        </div>
      </div>
    </>
  );
}

function SponsorFields({ sponsor }: { sponsor?: Sponsor }) {
  return (
    <>
      <Grid>
        <TextField label="Name" name="name" defaultValue={sponsor?.name} required />
        <TextField label="Website" name="url" type="url" defaultValue={sponsor?.url} placeholder="https://…" />
      </Grid>
      <TextArea label="Description" name="description" rows={2} defaultValue={sponsor?.description} hint="Optional. Not shown publicly yet." />
      <MediaField
        name="logo_media_id"
        label="Logo"
        current={sponsor?.logo_media_id && sponsor.logo_key ? { id: sponsor.logo_media_id, r2_key: sponsor.logo_key, filename: sponsor.name } : null}
        hint="Transparent PNG or SVG works best. Shown on a light tile."
      />
    </>
  );
}

function TierFields({ tier, rank }: { tier?: SponsorTier; rank?: number }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_96px] gap-4">
        <TextField label="Name" name="name" defaultValue={tier?.name} placeholder="Titanium" required />
        <TextField label="Rank" name="rank" type="number" defaultValue={tier?.rank ?? rank} hint="Lower shows first." />
      </div>
      <Grid>
        <TextField
          label="Amount"
          name="amount"
          defaultValue={tier?.amount}
          placeholder="$5,000+"
          hint="The big number on the levels table. Leave it blank to keep this tier off the table."
        />
        <TextArea
          label="Under the amount"
          name="amount_note"
          rows={2}
          defaultValue={tier?.amount_note}
          placeholder={"$5,000–$9,999\nor 3–9 mentors"}
          hint="One line each: the full range, other ways to reach this level."
        />
      </Grid>
      <TextArea
        label="Pays for"
        name="provides"
        rows={3}
        defaultValue={tier?.provides.join("\n")}
        placeholder={"Transportation to competitions\nCompetition equipment"}
        hint="One per line."
      />
      <TextArea
        label="Sponsors get"
        name="benefits"
        rows={5}
        defaultValue={tier ? specsToText(tier.benefits) : ""}
        placeholder={"Team shirt: Several\nLogo on robot"}
        hint="One per line. Word them the same on every tier so the table lines them up. Add a note after a colon: Team shirt: Several."
      />
      <SelectField
        label="On the sponsor wall"
        name="logo_size"
        defaultValue={tier?.logo_size ?? "small"}
        options={SPONSOR_LOGO_SIZES}
        hint="How this tier's sponsors show on the Sponsors page, homepage and season pages."
      />
    </>
  );
}

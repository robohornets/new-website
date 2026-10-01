import type { Metadata } from "next";
import { getMediaOptions, resolveSeasonParam } from "@/lib/admin-data";
import { all } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import type { Sponsor, SponsorTier } from "@/lib/types";
import { ActionForm } from "../_components/action-form";
import { AddButton, Badge, ModalItem, RowContent, TrashAction } from "../_components/items";
import { EditForm } from "../_components/unsaved";
import { AdminPageHeader, Grid, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { MediaField } from "../_components/media-field";
import { SeasonPicker } from "../_components/season-picker";
import { createSponsor, createTier, deleteSponsor, deleteTier, updateSponsor, updateTier } from "./actions";
import { requireAdminPage } from "@/lib/auth";

export const metadata: Metadata = { title: "Sponsors" };

export default async function AdminSponsorsPage(props: PageProps<"/admin/sponsors">) {
  await requireAdminPage();
  const { season } = await props.searchParams;
  const { year, years } = await resolveSeasonParam(season);
  const [sponsors, tiers, lineup, library] = await Promise.all([
    all<Sponsor>("SELECT s.*, m.r2_key AS logo_key FROM sponsors s LEFT JOIN media m ON m.id = s.logo_media_id ORDER BY s.name"),
    all<SponsorTier>("SELECT * FROM sponsor_tiers ORDER BY rank, name"),
    year
      ? all<{ sponsor_id: number; tier_id: number; sort_order: number }>(
          "SELECT sponsor_id, tier_id, sort_order FROM sponsor_seasons WHERE season_year = ?",
          year,
        )
      : [],
    getMediaOptions(),
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
            description={year ? `Tiers shown are for ${year}. Pick another season at the top to see or change its tiers.` : undefined}
            actions={
              <AddButton label="Add sponsor" title="Add a sponsor" action={createSponsor.bind(null, year)} size="lg">
                {year && tiers.length > 0 && (
                  <SelectField label={`${year} tier`} name="tier_id" options={[{ value: "", label: "Not this season" }, ...tierOptions]} />
                )}
                <SponsorFields library={library} />
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
                        badges={year ? tier ? <Badge>{tier.name}</Badge> : <span className="font-label text-xs text-ash">Not in {year}</span> : undefined}
                      />
                    }
                  >
                    {year && tiers.length > 0 && (
                      <Grid>
                        <SelectField
                          label={`${year} tier`}
                          name="tier_id"
                          defaultValue={current?.tier_id ?? ""}
                          options={[{ value: "", label: "Not this season" }, ...tierOptions]}
                        />
                        <TextField label="Order within tier" name="sort_order" type="number" defaultValue={current?.sort_order ?? 0} hint="Lower shows first." />
                      </Grid>
                    )}
                    <SponsorFields sponsor={s} library={library} />
                  </ModalItem>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Tiers" description="Lower rank shows first. The top tier gets large tiles.">
            <ActionForm action={createTier} submitLabel="Add tier" submitVariant="secondary" resetOnSuccess>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <TextField label="New tier" name="name" placeholder="Platinum" />
                <TextField label="Rank" name="rank" type="number" defaultValue={tiers.length} />
              </div>
            </ActionForm>
            <ul className="flex flex-col gap-2 border-t border-line pt-4">
              {tiers.map((t) => (
                <li key={t.id} className="flex items-end gap-2">
                  <EditForm action={updateTier.bind(null, t.id)} className="grow">
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <TextField label="Name" name="name" defaultValue={t.name} />
                      <TextField label="Rank" name="rank" type="number" defaultValue={t.rank} />
                    </div>
                  </EditForm>
                  <span className="pb-0.5">
                    <TrashAction label={`Delete the ${t.name} tier`} confirm={`Delete the ${t.name} tier?`} action={deleteTier.bind(null, t.id)} />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function SponsorFields({ sponsor, library }: { sponsor?: Sponsor; library: { id: number; r2_key: string; filename: string }[] }) {
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
        current={library.find((m) => m.id === sponsor?.logo_media_id) ?? null}
        library={library}
        hint="Transparent PNG or SVG works best. Shown on a light tile."
      />
    </>
  );
}

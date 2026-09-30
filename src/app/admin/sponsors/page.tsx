import type { Metadata } from "next";
import { getMediaOptions, resolveSeasonParam } from "@/lib/admin-data";
import { all } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import type { Sponsor, SponsorTier } from "@/lib/types";
import { ActionButton, ActionForm } from "../_components/action-form";
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
        description="Sponsors are saved once and given a tier for each season they support (under Edit). The public site shows the current season's sponsors."
      />
      <SeasonPicker basePath="/admin/sponsors" years={years} current={year} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Add a sponsor">
            <ActionForm action={createSponsor.bind(null, year)} submitLabel="Add sponsor" resetOnSuccess>
              <SponsorFields library={library} />
              {year && tiers.length > 0 && (
                <SelectField label={`${year} tier`} name="tier_id" options={[{ value: "", label: "Not this season" }, ...tierOptions]} />
              )}
            </ActionForm>
          </Panel>
          <Panel title="All sponsors" description={year ? `Tiers shown are for ${year}. Pick another season at the top to see or change its tiers.` : undefined}>
            {sponsors.length === 0 && <p className="text-sm text-dust">No sponsors yet.</p>}
            <ul className="flex flex-col gap-3">
              {listed.map((s) => {
                const current = bySponsor.get(s.id);
                const tier = current ? tierById.get(current.tier_id) : undefined;
                return (
                  <li key={s.id}>
                    <details className="group rounded-md border border-line bg-ink">
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3">
                        <span className="flex h-10 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-bone">
                          {s.logo_key ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mediaUrl(s.logo_key, 320) ?? ""} alt="" className="max-h-8 max-w-[72px] object-contain" />
                          ) : (
                            <span className="font-label text-[10px] text-ink/60">NO LOGO</span>
                          )}
                        </span>
                        <span className="min-w-0 grow truncate font-semibold">{s.name}</span>
                        {year &&
                          (tier ? (
                            <span className="shrink-0 rounded bg-raise px-2 py-1 font-label text-xs font-bold tracking-wider text-bone uppercase">
                              {tier.name}
                            </span>
                          ) : (
                            <span className="shrink-0 font-label text-xs text-ash">Not in {year}</span>
                          ))}
                        <span className="w-8 shrink-0 text-right text-sm text-hornet group-open:hidden">Edit</span>
                      </summary>
                      <div className="flex flex-col gap-4 border-t border-line p-4">
                        <EditForm action={updateSponsor.bind(null, s.id, year)}>
                          {year && tiers.length > 0 && (
                            <Grid>
                              <SelectField
                                label={`${year} tier`}
                                name="tier_id"
                                defaultValue={current?.tier_id ?? ""}
                                options={[{ value: "", label: "Not this season" }, ...tierOptions]}
                              />
                              <TextField
                                label="Order within tier"
                                name="sort_order"
                                type="number"
                                defaultValue={current?.sort_order ?? 0}
                                hint="Lower shows first."
                              />
                            </Grid>
                          )}
                          <SponsorFields sponsor={s} library={library} />
                        </EditForm>
                        <div className="border-t border-line pt-4">
                          <ActionButton action={deleteSponsor.bind(null, s.id)} variant="danger" confirm={`Delete ${s.name} from every season?`}>
                            Delete sponsor
                          </ActionButton>
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
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
            <ul className="flex flex-col gap-3 border-t border-line pt-4">
              {tiers.map((t) => (
                <li key={t.id} className="flex flex-wrap items-end gap-2">
                  <EditForm action={updateTier.bind(null, t.id)} className="grow">
                    <div className="grid grid-cols-[1fr_80px] gap-2">
                      <TextField label="Name" name="name" defaultValue={t.name} />
                      <TextField label="Rank" name="rank" type="number" defaultValue={t.rank} />
                    </div>
                  </EditForm>
                  <ActionButton action={deleteTier.bind(null, t.id)} variant="danger" confirm={`Delete the ${t.name} tier?`}>
                    Delete
                  </ActionButton>
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

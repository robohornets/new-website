import type { Metadata } from "next";
import { getMediaOptions, resolveSeasonParam } from "@/lib/admin-data";
import { all } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import type { Sponsor, SponsorTier } from "@/lib/types";
import { ActionButton, ActionForm } from "../_components/action-form";
import { EditForm } from "../_components/unsaved";
import { AdminPageHeader, Grid, inputClass, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { MediaField } from "../_components/media-field";
import { SeasonPicker } from "../_components/season-picker";
import { createSponsor, createTier, deleteSponsor, deleteTier, saveLineup, updateSponsor, updateTier } from "./actions";
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

  return (
    <>
      <AdminPageHeader
        title="Sponsors"
        description="Sponsors are saved once and assigned a tier for each season they support. The public site shows the current season's lineup."
      />
      <SeasonPicker basePath="/admin/sponsors" years={years} current={year} />

      {year && (
        <Panel title={`${year} lineup`} description="Pick a tier for everyone sponsoring this season. Leave 'Not this season' for the rest.">
          {sponsors.length === 0 ? (
            <p className="text-sm text-dust">Add a sponsor below first.</p>
          ) : (
            <EditForm action={saveLineup.bind(null, year)}>
              <input type="hidden" name="ids" value={sponsors.map((s) => s.id).join(",")} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="font-label text-[11px] tracking-wider text-ash uppercase">
                    <tr>
                      <th className="py-2 pr-4 font-normal">Sponsor</th>
                      <th className="py-2 pr-4 font-normal">Tier</th>
                      <th className="w-28 py-2 font-normal">Order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sponsors.map((s) => {
                      const current = bySponsor.get(s.id);
                      return (
                        <tr key={s.id} className="border-t border-line">
                          <td className="py-2.5 pr-4 font-semibold">{s.name}</td>
                          <td className="py-2.5 pr-4">
                            <select name={`tier_${s.id}`} defaultValue={current?.tier_id ?? 0} aria-label={`${s.name} tier`} className={inputClass}>
                              <option value={0}>Not this season</option>
                              {tiers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5">
                            <input
                              type="number"
                              name={`order_${s.id}`}
                              defaultValue={current?.sort_order ?? 0}
                              aria-label={`${s.name} order`}
                              className={inputClass}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </EditForm>
          )}
        </Panel>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <Panel title="Add a sponsor">
            <ActionForm action={createSponsor.bind(null, year)} submitLabel="Add sponsor" resetOnSuccess>
              <SponsorFields library={library} />
              {year && tiers.length > 0 && (
                <SelectField label={`${year} tier`} name="tier_id" options={[{ value: "", label: "Not this season" }, ...tierOptions]} />
              )}
            </ActionForm>
          </Panel>
          <Panel title="All sponsors">
            {sponsors.length === 0 && <p className="text-sm text-dust">No sponsors yet.</p>}
            <ul className="flex flex-col gap-3">
              {sponsors.map((s) => (
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
                      <span className="grow font-semibold">{s.name}</span>
                      <span className="text-sm text-hornet group-open:hidden">Edit</span>
                    </summary>
                    <div className="flex flex-col gap-4 border-t border-line p-4">
                      <EditForm action={updateSponsor.bind(null, s.id)}>
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
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
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

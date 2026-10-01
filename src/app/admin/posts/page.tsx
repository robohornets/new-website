import type { Metadata } from "next";
import { MediaImage } from "@/components/media-image";
import { getCurrentYear, getSeasonYears } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { POST_COLUMNS } from "@/lib/data";
import { all } from "@/lib/db";
import { formatDate, seasonLabel } from "@/lib/format";
import type { Post } from "@/lib/types";
import { AdminPageHeader, Panel, SelectField, TextField } from "../_components/fields";
import { AddButton, Badge, LinkRow, RowContent } from "../_components/items";
import { createPost } from "./actions";

export const metadata: Metadata = { title: "Outreach posts" };

export default async function AdminPostsPage() {
  await requireAdminPage();
  const [posts, years, current] = await Promise.all([
    all<Post>(`SELECT ${POST_COLUMNS} FROM posts p ORDER BY p.category = 'news', p.published, COALESCE(p.published_at, p.created_at) DESC`),
    getSeasonYears(),
    getCurrentYear(),
  ]);
  const outreach = posts.filter((p) => p.category === "outreach");
  const news = posts.filter((p) => p.category === "news");

  const row = (p: Post) => (
    <LinkRow key={p.id} href={`/admin/posts/${p.id}`}>
      <RowContent
        opens="page"
        media={<MediaImage mediaKey={p.cover_key} alt="" className="h-12 w-16 rounded" sizes="64px" maxWidth={320} placeholder="" />}
        title={p.title}
        meta={[p.season_year ? `${seasonLabel(p.season_year)} season` : "No season", formatDate(p.published_at ?? p.created_at)].join(" · ")}
        badges={
          p.category === "news" ? (
            <Badge tone="muted">Not on the site</Badge>
          ) : p.published ? (
            <Badge tone="accent">Live</Badge>
          ) : (
            <Badge tone="muted">Draft</Badge>
          )
        }
      />
    </LinkRow>
  );

  return (
    <>
      <AdminPageHeader
        title="Outreach posts"
        description="Stories about demos, recruiting, the Impact Award and everything else the team does in the community. They're shown on the Impact page, the homepage and their season's page. Drafts stay hidden until you publish them."
      />
      <Panel
        title="Posts"
        actions={
          <AddButton label="New post" title="New outreach post" description="Name it now; write it and add photos on its page. It stays a draft until you publish it." action={createPost} submitLabel="Create draft">
            <TextField label="Title" name="title" required placeholder="Demo night at the Tulsa library" />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={current ?? ""}
              options={[{ value: "", label: "Not tied to a season" }, ...years.map((y) => ({ value: y, label: `${seasonLabel(y)} season` }))]}
            />
          </AddButton>
        }
      >
        <div className="flex flex-col gap-2">
          {outreach.length === 0 && <p className="text-sm text-dust">No posts yet. Start one with the button above.</p>}
          {outreach.map(row)}
        </div>
      </Panel>
      {news.length > 0 && (
        <Panel title="Old news posts" description="Written for the News section, which isn't on the site anymore. Open one to move it to the Impact page, or delete it.">
          <div className="flex flex-col gap-2">{news.map(row)}</div>
        </Panel>
      )}
    </>
  );
}

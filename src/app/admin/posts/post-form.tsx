import type { MediaOption } from "@/lib/admin-data";
import type { Post } from "@/lib/types";
import type { ActionState } from "@/lib/admin";
import { ActionForm } from "../_components/action-form";
import { EditForm } from "../_components/unsaved";
import { Checkbox, Grid, Panel, SelectField, TextArea, TextField } from "../_components/fields";
import { MediaField } from "../_components/media-field";
import { MarkdownEditor } from "./markdown-editor";

export function PostForm({
  post,
  action,
  library,
  years,
}: {
  post?: Post;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  library: MediaOption[];
  years: number[];
}) {
  const fields = (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel>
          <TextField label="Title" name="title" defaultValue={post?.title} required />
          <TextArea label="Summary" name="excerpt" rows={2} defaultValue={post?.excerpt} hint="One or two sentences shown on cards and in search results." />
          <MarkdownEditor name="body" defaultValue={post?.body ?? ""} />
        </Panel>
        <div className="flex flex-col gap-6">
          <Panel title="Publishing">
            <Checkbox label="Published" name="published" defaultChecked={post ? post.published === 1 : false} hint="Drafts are only visible here." />
            <TextField label="Date" name="published_at" type="date" defaultValue={post?.published_at?.slice(0, 10)} hint="Leave blank to use today when publishing." />
            <SelectField
              label="Section"
              name="category"
              defaultValue={post?.category ?? "news"}
              options={[
                { value: "news", label: "News" },
                { value: "outreach", label: "Outreach" },
              ]}
            />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={post?.season_year ?? ""}
              options={[{ value: "", label: "Not tied to a season" }, ...years.map((y) => ({ value: y, label: String(y) }))]}
              hint="Also lists the post on that season's page."
            />
            <Grid cols={2}>
              <TextField label="URL slug" name="slug" defaultValue={post?.slug} hint="Made from the title if blank." className="md:col-span-2" />
            </Grid>
          </Panel>
          <Panel title="Cover image">
            <MediaField name="cover_media_id" label="Cover" current={library.find((m) => m.id === post?.cover_media_id) ?? null} library={library} />
          </Panel>
        </div>
      </div>
  );
  // Editing goes through the save bar; a new post has its own Create button.
  return post ? (
    <EditForm action={action}>{fields}</EditForm>
  ) : (
    <ActionForm action={action} submitLabel="Create post">
      {fields}
    </ActionForm>
  );
}

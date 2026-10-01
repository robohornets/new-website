import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { specsToText } from "@/lib/admin";
import { directUploadsEnabled, getSeasonYears } from "@/lib/admin-data";
import { requireAdminPage } from "@/lib/auth";
import { FIRST_IMAGE, getRobot } from "@/lib/data";
import { all, first } from "@/lib/db";
import { seasonLabel } from "@/lib/format";
import { ActionButton } from "../../_components/action-form";
import { BulkUploader } from "../../_components/bulk-uploader";
import { AdminPageHeader, DeletePanel, Grid, Panel, SelectField, TextArea, TextField } from "../../_components/fields";
import { PhotosEditor, type EditorPhoto } from "../../_components/photos-editor";
import { AlbumField, type LibraryAlbum } from "../../_components/library-picker";
import { EditForm } from "../../_components/unsaved";
import { deleteRobot, ensureRobotAlbum, setRobotAlbum, updateRobot } from "../actions";

export const metadata: Metadata = { title: "Edit robot" };

const ROBOT_KINDS = [
  { value: "competition", label: "Competition robot" },
  { value: "kitbot", label: "Kitbot" },
  { value: "offseason", label: "Offseason robot" },
  { value: "prototype", label: "Prototype" },
];

export default async function AdminRobotPage(props: PageProps<"/admin/robots/[id]">) {
  await requireAdminPage();
  const id = Number((await props.params).id);
  const { created } = await props.searchParams;
  const robot = Number.isInteger(id) ? await getRobot(id) : null;
  if (!robot) notFound();

  const [photos, album, direct, years] = await Promise.all([
    robot.album_id
      ? all<EditorPhoto>(
          `SELECT ap.media_id, m.r2_key, m.alt, m.filename, ap.caption FROM album_photos ap JOIN media m ON m.id = ap.media_id
           WHERE ap.album_id = ? ORDER BY ap.sort_order, m.created_at`,
          robot.album_id,
        )
      : [],
    robot.album_id
      ? first<LibraryAlbum & { cover_media_id: number | null; published: number }>(
          `SELECT a.id, a.title, a.season_year, a.cover_media_id, a.published,
              (SELECT COUNT(*) FROM album_photos ap WHERE ap.album_id = a.id) AS photos,
              (SELECT mi.r2_key FROM media mi WHERE mi.id = COALESCE(a.cover_media_id, ${FIRST_IMAGE})) AS cover_key
       FROM albums a WHERE a.id = ?`,
          robot.album_id,
        )
      : null,
    directUploadsEnabled(),
    getSeasonYears(),
  ]);
  const season = seasonLabel(robot.season_year);

  return (
    <>
      <AdminPageHeader
        breadcrumb={
          <>
            <Link href="/admin/seasons">Seasons</Link> / <Link href={`/admin/seasons/${robot.season_year}#robots`}>{season}</Link> /
          </>
        }
        title={robot.name}
        description={created ? "Robot added. Fill in its details, then upload its photos below." : `${ROBOT_KINDS.find((k) => k.value === robot.kind)?.label} · ${season} season`}
        actions={
          <Link href={`/seasons/${robot.season_year}`} className="flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-bone">
            View on site
          </Link>
        }
      />

      <Panel title="Details">
        <EditForm action={updateRobot.bind(null, robot.id)}>
          <Grid cols={4}>
            <TextField label="Name" name="name" defaultValue={robot.name} required />
            <SelectField label="Type" name="kind" defaultValue={robot.kind} options={ROBOT_KINDS} hint="The first competition robot is featured on the homepage and season page." />
            <SelectField
              label="Season"
              name="season_year"
              defaultValue={robot.season_year}
              options={years.map((y) => ({ value: y, label: `${seasonLabel(y)} season` }))}
              hint="Its own photo album moves with it."
            />
            <TextField label="Order" name="sort_order" type="number" defaultValue={robot.sort_order} hint="Lower shows first when a season has several robots." />
          </Grid>
          <TextArea label="Description" name="description" rows={3} defaultValue={robot.description} />
          <Grid>
            <TextArea
              label="Specs"
              name="specs"
              rows={6}
              mono
              defaultValue={specsToText(robot.specs)}
              placeholder={"Drivetrain: Swerve, 8 × Kraken X60\nAutonomous: PathPlanner"}
              hint="One per line, as Label: value"
            />
            <div className="flex flex-col gap-4">
              <TextField label="Tags" name="tags" defaultValue={robot.tags.join(", ")} hint="Comma separated, e.g. Swerve, Elevator" />
              <TextField label="Code link" name="code_url" type="url" defaultValue={robot.code_url} placeholder="https://github.com/robohornets/…" hint="Also listed on the season's Resources tab." />
              <TextField label="CAD link" name="cad_url" type="url" defaultValue={robot.cad_url} hint="Also listed on the season's Resources tab." />
            </div>
          </Grid>
        </EditForm>
      </Panel>

      <Panel
        title="Photos"
        description={
          <>
            {robot.kind === "competition" ? `A slideshow at the top of the ${season} season page, in this order` : "Shown in the season page's robot list"}.
            The first photo (or the one you make the main photo) is used everywhere else.
            {album && (
              <>
                {" "}They&apos;re the album{" "}
                <Link href={`/admin/gallery/${album.id}`} className="font-semibold text-hornet hover:text-hornet-hover">
                  {album.title}
                </Link>
                {album.published ? ", which also shows in the Gallery." : " (hidden from the Gallery)."}
              </>
            )}
          </>
        }
      >
        <BulkUploader
          albumId={album?.id}
          ensureAlbum={album ? undefined : ensureRobotAlbum.bind(null, robot.id)}
          label={`Add photos of ${robot.name}`}
          direct={direct}
        />
        {/* Keyed by the album, so it shows the new one after the first upload makes it. */}
        <EditForm key={robot.album_id ?? "none"} action={setRobotAlbum.bind(null, robot.id)}>
          <AlbumField
            name="album_id"
            current={album}
            noneLabel="Its own album, made when you upload above"
            hint="Already have the photos in an album? Use it instead of uploading them again."
          />
        </EditForm>
        {album && photos.length > 0 && <PhotosEditor albumId={album.id} coverId={album.cover_media_id} photos={photos} coverLabel="Make main photo" />}
      </Panel>

      <DeletePanel title="Delete this robot" description={`Removes the robot from the ${season} season. Its photo album stays in the Gallery.`}>
        <ActionButton action={deleteRobot.bind(null, robot.id)} variant="danger" confirm={`Delete ${robot.name}? Its photos stay in the Gallery.`}>
          Delete robot
        </ActionButton>
      </DeletePanel>
    </>
  );
}

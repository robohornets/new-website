# btwrobotics.com

The website for **FRC Team 1209 - RoboHornets** (Booker T. Washington High School, Tulsa).

- **Next.js 16 + TypeScript + Tailwind 4**, deployed as a **Cloudflare Worker** with [OpenNext](https://opennext.js.org/cloudflare)
- **D1** (SQLite) holds every piece of site content
- **R2** holds every uploaded photo, video and logo, stored once exactly as uploaded
- **Cloudflare Images** (transformations) resizes photos on the fly for each spot on the site
- **Cloudflare Access** protects the `/admin` panel, where the team updates the site without touching code

---

## One-time setup

You need Node 20.9+ and a Cloudflare login (`npx wrangler login`).

### 1. Install

```bash
npm install
```

### 2. Create the R2 bucket

```bash
npx wrangler r2 bucket create btwrobotics-media
```

The name must match `r2_buckets[0].bucket_name` in `wrangler.jsonc`.

**Direct uploads (for videos up to 1 GB).** Without this, every upload goes through the Worker and is capped at
95 MB. With it, the browser uploads straight to R2 and the Worker never handles the file:

1. In the Cloudflare dashboard, **R2 → Manage API tokens → Create API token**. Permission **Object Read & Write**,
   applied to the `btwrobotics-media` bucket only. Copy the **Access Key ID** and **Secret Access Key**.
2. Save them as Worker secrets:
   ```bash
   npx wrangler secret put R2_ACCESS_KEY_ID
   npx wrangler secret put R2_SECRET_ACCESS_KEY
   ```
   (`R2_ACCOUNT_ID` and `R2_BUCKET_NAME` are already in `wrangler.jsonc`.)
3. **R2 → btwrobotics-media → Settings → CORS policy**, add:
   ```json
   [{ "AllowedOrigins": ["https://btwrobotics.com"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
   Add your `*.workers.dev` address to `AllowedOrigins` too if you use the admin there.

The uploader says "up to 1 GB" once this is working. If the CORS rule is missing, uploads under 95 MB quietly fall
back to the Worker and bigger ones say to check it.

### 3. Create the tables and starter content in D1

The D1 database (`0a483600-2eec-4bff-a8d3-739fcb5b1962`) is already set in `wrangler.jsonc`.

```bash
npm run db:migrate:remote
```

This runs `migrations/0001_initial.sql` (the schema), `migrations/0002_seed_content.sql` (text, contacts,
socials, the 2024–2026 robots and the posts from the previous site, which later became impact events) and any later
migrations. Wrangler tracks which migrations have run, so this is safe to rerun after every pull.

### 4. Set up Cloudflare Access for `/admin`

1. Cloudflare dashboard → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Application domain: `btwrobotics.com`, path: `admin`. This covers `/admin` and everything under it, including uploads.
3. Add a policy, for example **Allow** → *Emails* → the mentors' and student leads' addresses (or *Emails ending in* `@tulsaschools.org`).
4. Save. On the application's **Overview** tab, copy the **Application Audience (AUD) Tag**.
5. Your **team domain** is under Zero Trust → Settings → Custom Pages (it looks like `robohornets.cloudflareaccess.com`).
6. Put both in `wrangler.jsonc`:

   ```jsonc
   "vars": {
     "CF_ACCESS_TEAM_DOMAIN": "robohornets.cloudflareaccess.com",
     "CF_ACCESS_AUD": "<the AUD tag>"
   }
   ```

The Worker also checks the Access token itself, so the admin stays locked even when the Worker is reached by its
`*.workers.dev` URL. While those two values are empty, the deployed admin is **locked for everyone**.

### 5. Connect The Blue Alliance

Events, rankings, awards and match results come from [The Blue Alliance](https://www.thebluealliance.com) (TBA).

1. Sign in at thebluealliance.com, open **Account**, and under **Read API Keys** add a key (description: "btwrobotics.com").
2. Store it as a Worker secret (never in `wrangler.jsonc`):

   ```bash
   npx wrangler secret put TBA_API_KEY
   ```

3. In the admin, go to **Seasons, robots & events** and click **Import all past seasons from TBA** once.

After that it runs itself: a cron trigger (`triggers.crons` in `wrangler.jsonc`, handled in `worker.ts`) fires every
15 minutes. During an event (the day before through the day after) it refreshes that event; once a day it checks
for newly registered events. It sends TBA's ETags back, so unchanged data isn't downloaded again. Each run touches
at most three events, which keeps it inside the Workers Free plan's per-run limits. Admins can also press
**Sync now** on a season or event at any time.

Admin edits always win: a field an admin changes is marked **Edited** and syncing never touches it again until
someone clicks **Reset to TBA** (`src/lib/tba/fields.ts`).

### 6. Pick a Workers plan

The **Workers Free** plan caps each request at 10 ms of CPU. Rendering a Next.js page usually takes 10–30 ms, so
busy pages on Free can fail with error 1102 (Cloudflare allows occasional overruns, not steady ones).
**Workers Paid ($5/month)** raises the cap to 30 s and includes 10 million requests a month, which is plenty for this
site. Upgrade under **Workers & Pages → Plans**. Nothing in the code needs to change when you switch.

Images transformations need no setup: the free Images plan includes 5,000 unique transformations a month (see
[Photos and videos](#photos-and-videos)).

### 7. Deploy

```bash
npm run deploy
```

Until the domain is set up, the site runs on the Worker's `*.workers.dev` address and the `routes` block in
`wrangler.jsonc` stays commented out. When `btwrobotics.com` is on Cloudflare, uncomment it, delete any old DNS
records for the domain (A/CNAME for the old host) in **DNS → Records**, and deploy again. Then point the Cloudflare
Access application at `btwrobotics.com/admin` too.

---

## Local development

```bash
npm run db:migrate:local   # creates a local D1 in .wrangler/ with the starter content
npm run dev                # http://localhost:3000
```

Under `npm run dev`, `/admin` is always open (you're signed in as `dev@localhost`) and uploads go to a local R2
emulation. `next dev` only runs on your own machine; the deployed Worker is a production build and always checks
Cloudflare Access. To try the real Worker runtime locally, run `npm run preview`, where the admin needs Access like
production does.

To sync from TBA locally, put your key in a `.dev.vars` file (git-ignored):

```
TBA_API_KEY=your-key
```

To run the cron job by hand: `npx opennextjs-cloudflare build && npx wrangler dev --test-scheduled`, then open
`http://localhost:8787/__scheduled?cron=*/15+*+*+*+*`.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run cf-typegen` (rerun after changing `wrangler.jsonc`).

---

## Updating the site each year

Everything is in **btwrobotics.com/admin**:

| When | Where | What |
| --- | --- | --- |
| Before or at kickoff | **Seasons → Start new season** | Year, game name, kickoff date. Carries over returning students (skips anyone whose graduation year has passed), mentors and sponsors, and makes it the homepage's current season. |
| Build season | **Seasons → (year)** | **+ Add robot**, then on its page: photos (they become the season page slideshow and a Gallery album), specs (`Label: value` per line), tags, code and CAD links. Set status to *Build season*. Add anything for other teams under **Resources**. |
| End of season | **Seasons → (year)** | Upload the engineering notebook PDF (or paste a link) under *Season basics*. |
| Before events | nothing | Events 1209 registers for appear from The Blue Alliance on their own. Upcoming ones show on the homepage. During the event a **LIVE NOW** card above the hero shows our next match (predicted time, partners and opponents), rank, record and last result, refreshing every minute. |
| During/after events | **Seasons → (year) → event** | Results and every match fill in automatically. Fix anything (it's marked **Edited**), add a write-up, highlight video or album, or hide an event/match. |
| Recruiting | **Join requests** | Switch the form on, share the `/join` link, then add students to the roster with one click (or decline). Switch it off when you're done. |
| Anytime | **Team roster** | Each person is a card: **Edit** opens a popup for their details, subteams and photo (add, replace, remove, or hide from the site); **Remove** takes them off the season. **Add person** and **Manage subteams** are at the top, with search and filters by subteam, class or leadership. Students show publicly as "First L." and their photos stay hidden unless *Show photo* is on. On the Team page students are grouped by main subteam (leaders first, showing their role), as compact cards with their photo or initials; a bio, if filled in, opens when the card is clicked. |
| Anytime | **Gallery**, **Sponsors** | Photo albums (drag and drop many files at once to upload; drag albums, and photos inside an album, into the order the site shows them), sponsors (each one's tier for the picked season is set under **Edit** and shown on its row). |
| When it changes | **Site text & links** | Mission, values and the Strategic Plan (PDF or link) on the Team page. |
| Anytime | Google Calendar | Meetings and events added to the team's public Google Calendar show on the Team page within about 10 minutes (the calendar is set under **Site text & links → Calendar**). |
| Rarely | **Site text & links** | Homepage hero, stats (`{members}` shows this season's student count, rounded down to the nearest 10), about text, socials, contact people, footer links, donate link. |
| After each demo or outreach | **Impact events** | Add the event (or open it), tick who went and save. Everyone gets the event's length unless you type their own hours. Optionally write its story (a summary, plus an article you publish when it's ready) and add photos. The public Impact page shows the season's totals (hours, events, people reached) and every event; per-person hours and CSVs are admin-only. |
| After kickoff | **Scouting** | Build this year's scouting form (copy last year's or start from the example), then tick **Open /scouting** and share the link. |
| Always | **Messages** | Contact form submissions. |

Older seasons stay browsable at `/seasons/<year>` with their robot, events, roster, sponsors and photos.

---

## Branding

The site follows the team's 2026 Branding Guidelines (Drive > Business > Media > Graphics).

- **Name:** always "RoboHornets" (one word, capital R and H). The formal name is "FRC Team 1209 - RoboHornets", used in page titles and the footer.
- **Colors** (`src/app/globals.css`): BTW Orange `#FC8C04` (`hornet`) is the primary color. Rusty Orange `#A53000` (`rust`) is
  the accent, used only as a background behind white text (labels, badges) because it's too dark to read as text on the
  dark background. White and black are secondary; the page background is a warm charcoal.
- **Type:** Raleway for body text and labels (the guidelines' typeface); Big Shoulders for the big condensed headings.
- **Section labels** are small spaced capitals with a short orange bar under them (`eyebrow eyebrow-bar`), like the guidelines deck.
- **Logos** (never mirror or recolor them; use SVG when possible):

| File | Used for | Source |
| --- | --- | --- |
| `public/brand/logo-lockup-on-dark.svg` | Header and footer | Main logo, white text, from the guidelines PDF |
| `public/brand/logo-lockup-on-light.svg` | Anything on a white background | Main logo, black text, from the guidelines PDF |
| `public/brand/hornet.svg` | Admin sidebar | Hornet on its own, from the guidelines PDF |
| `public/images/robohornet.png` | Source for the favicon | Full-size hornet artwork |
| `src/app/icon.png`, `src/app/apple-icon.png` | Browser tab and home-screen icons | Made from `robohornet.png` |
| `src/app/opengraph-image.png` | Link previews (iMessage, Discord, social) | The dark lockup on charcoal |

The SVGs were taken straight from the vector artwork in the guidelines PDF. To use the originals from the Drive
instead, save them over these files with the same names. For the favicon, the guidelines call for the **simplified
hornet** at small sizes: save its SVG as `src/app/icon.svg` and delete `src/app/icon.png`.

## How it's built

```
src/app/(site)/        public pages (home, team, seasons, impact, gallery, sponsors, contact)
src/app/join/          the unlisted join-request form (on/off in the admin)
src/app/scouting/      the public scouting app (/scouting) and its API (/scouting/api/*)
src/app/admin/         admin panel: pages, server actions, api/upload
src/app/admin/_help/   the admin's Help panel and its guides (guides.ts): update them when the admin changes
src/app/media/[...key] serves R2 originals, and resized copies via the Images binding
src/lib/               db helpers, data queries, Cloudflare Access auth, types
src/lib/tba/           The Blue Alliance client, field mapping, overrides and sync (plain Worker code)
migrations/            D1 schema and seed data
worker.ts              Worker entry: serves the OpenNext build and runs the TBA cron job
wrangler.jsonc         Worker config: D1, R2, Images, cron, Access and TBA vars, custom domain
open-next.config.ts    OpenNext adapter config
```

Every page reads D1 per request (`src/lib/cf.ts` calls `connection()`), so admin changes are live right away and
no ISR cache bucket is needed.

### Database schema

Content is organised around **seasons**. Each FRC year is a row, and most other content hangs off it:

- `seasons`: year (PK: the year of the FRC game, so 2027 is the 2026-27 season; shown everywhere as "26-27" by `seasonLabel()` in `src/lib/format.ts`, while URLs keep the year, `/seasons/2027`), game name, summary, status (`pre_kickoff` / `build` / `competition` / `offseason`), kickoff date, reveal video, hero photo, engineering notebook (uploaded PDF and/or link), `is_current` (at most one)
- `robots`: per season: name, kind (competition / kitbot / …), description, specs JSON, tags JSON, code and CAD links, and `album_id`: the album its photos come from (the season page slideshow; its cover or first photo is the robot's main photo). `photo_media_id` is the single photo robots had before albums, still used if a robot has no album.
- `events`: per season: name, kind, location, dates, website, webcast, Blue Alliance key, rank, record, alliance,
  playoff result, awards, plus admin-only extras (write-up, highlight video, album, hidden). `tba` holds the latest
  TBA values and `overrides` lists the fields an admin changed; syncing only writes fields not in that list.
- `matches`: per event: round, teams on each alliance, scores, our side, result, video, hidden, with the same
  `tba`/`overrides` pair
- `outreach_attendance`: who went to each impact event (an event with kind `outreach`) and their hours, or NULL for the event's own `outreach_hours`. `events.people_reached` is the rough head count.
- `tba_cache`: the last ETag for each TBA request, so unchanged data is skipped
- `people` + `roster_entries`: a person exists once; a roster entry puts them on a season with a role, main subteam and leadership flag. This is how the roster carries over year to year.
- `subteams` + `roster_extra_subteams`: the subteam list admins edit (private ones can't be picked on the join form), and any extra subteams a roster entry is on
- `scouting_forms`, `scouting_entries`, `scouting_history`: see Scouting below. `scouting_forms.published` puts a season's scouting on its public Scouting tab.
- `resources`: links and files on a season's Resources tab (`season_year` NULL for team documents shown on every season)
- `join_requests`: students asking to join from `/join` (name, class, subteam ranking, about), with pending / added / declined status. The form only accepts requests while `site_settings.join_requests.open` is on.
- `sponsors` + `sponsor_tiers` + `sponsor_seasons`: sponsors are stored once; each season lists who sponsored it and at what tier
- `posts`: posts from before impact events. Migration 0014 turned every outreach post into an impact event (`posts.event_id` says which, so old `/news/<slug>` and `/impact/<slug>` links redirect to it); old News posts stay here, hidden, until an admin turns one into an impact event. Export still downloads the table.
- `albums` + `album_photos`: gallery albums, optionally tied to a season, each with a `sort_order` (albums on the Gallery and season pages; photos inside an album) set by dragging in the admin
- `media`: every file uploaded to R2 (key, original filename, type, size, pixel width/height, alt text, and the browser's fingerprints `sha256` and `phash` for spotting duplicates). Other tables point at it by id. `media_distinct` holds pairs an admin said aren't duplicates.
- `site_settings`: key/value JSON for editable page text, including the mission, values and Strategic Plan
- `contacts`: people listed on the Contact page
- `messages`: contact form submissions (the sender IP is stored only as a hash, for rate limiting)
- `audit_log`: who changed what in the admin

### Photos and videos

Every upload goes to R2 **once, unchanged**. That file is the only copy: nothing else is written to storage.

- `/media/<key>` returns the original, byte for byte. `?download=1` downloads it with its original filename.
- `/media/<key>?w=640` returns a resized copy made by Cloudflare Images from that original: WebP (or JPEG/PNG for
  old browsers), cached at the edge, never stored. Pages ask for one of five widths (320, 640, 960, 1280, 1920)
  through `srcset`, so phones get small files and big screens get sharp ones. CSS crops the image to fit each spot.
- Each photo can have at most five resized versions, so the free Images allowance (5,000 unique transformations a
  month) covers about 1,000 different photos viewed at every size each month. If it runs out, the site
  serves the originals until the next month instead of breaking. Nothing is billed on the free Images plan.
- iPhone HEIC photos are fine: the resized copies are WebP/JPEG, which every browser can show.
- Videos (MP4/MOV/WebM; up to 1 GB with direct uploads, 95 MB without) are served straight from R2 with range
  requests, so they stream and seek. Before uploading, the browser converts anything that isn't already H.264 MP4
  (iPhone HEVC `.mov`, WebM) with [mediabunny](https://mediabunny.dev) on the device's own video encoder, shrinking
  anything over 1080p (`src/app/admin/_components/upload-client.ts`). Videos are the one thing not stored exactly as
  uploaded: the converted MP4 is kept instead, because HEVC doesn't play in Chrome on many Windows and Android
  devices. If a device can't convert (no WebCodecs, or a file over 700 MB), the original uploads with a warning.
  For long videos like full matches, the team YouTube channel is still the better home.

**Uploads and the 10 ms CPU limit.** Upload requests are answered by `worker.ts` itself (`src/lib/upload.ts`), before
they reach Next.js. Profiling a 7.5 MB phone photo on workerd showed why: through Next, OpenNext copies the whole
request body through Node.js streams in JavaScript (often 100+ ms of CPU, more for bigger files). Two ways in:

- **Straight to R2** (when the R2 API keys are set, see setup step 2): `POST /admin/api/upload/start` checks the type
  and size and returns a presigned PUT URL for one new key, valid for an hour (aws4fetch; the content type is part of
  the signature, so a file can't be stored as anything but the type that was checked). The browser PUTs the file to
  R2 with upload progress, then `POST /admin/api/upload/finish` records it. `/finish` only accepts the key `/start`
  handed out (an HMAC "receipt" signed with the R2 secret, tied to the admin, size and type) and checks the stored
  object's size, deleting it if it's incomplete.
- **Through the Worker** (no keys yet, or `next dev`): `POST /admin/api/upload` with the file as the body, streamed
  into R2 natively with `FixedLengthStream`, up to 95 MB.

Either way the browser reads the photo's pixel size and sends it along; only when it can't (HEIC outside Safari)
does the Worker read the file back for the Images binding to measure. The Cloudflare Access token is checked the same
way as the rest of the admin (`src/lib/access.ts`, cached per token for a bulk upload), and requests from any other
site are refused.

Why not Cloudflare *hosted* Images or Stream? Hosted Images needs the paid Images plan (from $5/month) and keeps
the originals in Cloudflare's own store, so they're harder to take elsewhere. Stream is $5 per 1,000 minutes
stored, plus $1 per 1,000 minutes watched. It's worth it for adaptive streaming of lots of video, not for a few
clips. R2 costs nothing up to 10 GB, has no bandwidth charges, and its files work with any S3 tool.

### Export and backup

**Admin → Export & backup**:

- **Content export (JSON)**: every table plus the database schema and migration list, in one file.
- **Spreadsheets (CSV)**: any single table, for Excel or Google Sheets.
- **Original files**: saves every upload, byte for byte, into a folder (Chrome/Edge; resumable) or a `.zip`,
  with a `files.json` index mapping stored names to the original filenames. Single files have a
  *Download original* link in the Media library and on album pages.

From a terminal:

```bash
# Full SQL dump of D1
npx wrangler d1 export DB --remote --output btwrobotics.sql

# Copy the whole R2 bucket, any size. Create an R2 API token (R2 → Manage API tokens, "Object Read"),
# then configure rclone once with provider Cloudflare and endpoint https://<account-id>.r2.cloudflarestorage.com
rclone config create r2 s3 provider=Cloudflare access_key_id=<key> secret_access_key=<secret> \
  endpoint=https://bf0f37839f565aba35f34152a14d23eb.r2.cloudflarestorage.com
rclone copy r2:btwrobotics-media ./btwrobotics-media --progress
```

### Scouting

`/scouting` is a public, team-by-team notebook for competitions (not linked from the site; share the link). It only
works while **Open /scouting** is on in the admin, and uses the current season's form.

- **Form** (`scouting_forms`, one per season): *Robot questions* (one shared sheet per team, like a wiki page) and
  *Match report* questions (any number per team, each tied to a TBA match or a general note). Field types are in
  `src/lib/scouting.ts`: heading, counter, yes/no, pick one, pick any, 1–5 rating, number, short text, notes. Answers are
  stored by field id, so renaming a question keeps its answers.
- **Data** (`scouting_entries`): anyone can add, edit or delete. The robot sheet merges per question, so two phones
  filling in different questions offline both keep their answers. Every change first copies the old version into
  `scouting_history`; the admin can restore any version or deleted entry.
- **Offline**: `public/scouting-sw.js` keeps the page and its files on the phone (production builds only). The app
  keeps the last copy of every event and team it opened in `localStorage` and queues changes there, uploading them to
  `POST /scouting/api/sync` when signal returns. Writes are rate limited per network (2000 changes an hour).
- **The Blue Alliance**: team lists, rankings, OPRs, team info, match lists and robot photos come through
  `tbaCachedJson` (`src/lib/tba/cache.ts`), which keeps each response in `tba_json_cache` for a few minutes and then
  revalidates with an ETag. Without a TBA key, scouts can still type team numbers.

### Impact events

An impact event (demo, school visit, recruiting night…) is an `events` row with kind `outreach`; the admin calls them
impact events. One page, **Impact events** (`src/app/admin/impact`), holds everything about one: its details and hours,
who went, its story and its photos. Details, story and attendance save together from the save bar. The story is
`events.recap` (the summary on its card) plus `events.story`, an optional Markdown article shown once
`story_published` is 1. Photos are `events.album_id`: the event's own album (slug `impact-<id>`, made on the first
upload, following the event's name, season and visibility) or any album picked under **Photos come from**. Events
without a story are just tracked; they still list on the Impact page with their summary.

Totals are in `src/lib/outreach.ts`: a person's hours are `COALESCE(attendance.hours, events.outreach_hours)`, and an
event counts once it has started or has anyone logged. Each impact event's public page is `/impact/<id>-<name>`
(`impactPath()` in `src/lib/format.ts`; `/seasons/<year>/events/<id>` redirects there). The public pages only get
`getPublicOutreachTotals()`, `getPublicOutreachEvents()` and `getPublicImpactEvent()` (name, date, place, people
reached, summary, story, photos), never names or anyone's hours. Published stories also show on the homepage and
their season's page. CSV downloads are at `/admin/api/outreach-export?season=YYYY&part=people|log`. Old admin links
(`/admin/outreach`, `/admin/posts`) redirect.

### Live match card

While a non-outreach event with a Blue Alliance key is on (by its dates, Tulsa time), the homepage shows
`LiveMatchCards` (`src/components/live-match-card.tsx`) above the hero instead of the plain live banner. The data
comes from `getLiveMatches()` (`src/lib/live-match.ts`): TBA's `/team/{key}/event/{event}/matches/simple` and
`/status` through `tbaCachedJson` with a 60-second max age, so TBA is asked at most once a minute however many people
are watching. Without a TBA key it uses the matches the sync job saved. The card polls `GET /api/live-match` every
minute while the tab is visible and removes itself when the list comes back empty.

### Season pages

`/seasons/<year>` has **Overview**, **Scouting** and **Resources** tabs (`src/components/season-tabs.tsx`), each its own
page so a link can go straight to one. A tab only shows when it has something in it (`getSeasonTabs`).

- **Overview** leads with the main robot's photos as a slideshow (`src/components/robot-slideshow.tsx`): a photo every
  5 seconds, paused while hovered or focused, a control bar (back, dots, next, pause) on hover and always on touch
  screens, swipe on phones, no autoplay with `prefers-reduced-motion`. The season photo (`seasons.hero_media_id`) is
  only for the homepage and Seasons list, and stands in on the season page until the robot has photos.
- **Scouting** (`src/lib/season-extras.ts`, `getPublicScouting`) is off until the admin ticks *Show on the season
  page*. Then it lists every team scouted that season with its robot sheet, match-report averages and every report,
  notes included, never scouts' names, and with no link to `/scouting`.
- **Resources** combines automatic items (each robot's code and CAD links, the engineering notebook, the Scouting tab,
  the Strategic Plan) with the `resources` table.

Album photos and the slideshow open a full-screen viewer (`src/components/lightbox.tsx`): the photo's Description
underneath (stored in `album_photos.caption`), back and forth by buttons, arrow keys or swipe, and the photo in the
address bar (`#photo-<id>`) so the phone's Back button closes it and a link can open one photo.

### Calendar

The Team page's *Meetings & events* comes from the public iCal feed of the Google Calendar set in
`site_settings.calendar.id` (default `btwrobotics@gmail.com`). `src/lib/calendar.ts` fetches it at most every 10
minutes (keeping the last copy in `feed_cache`, so it still shows if Google is down), expands repeating events with
`ical.js` (skipped and moved occurrences included), and lists the next 60 days in Central time.

### Admin forms and the save bar

Edits go through `EditForm` (`src/app/admin/_components/unsaved.tsx`) instead of a Save button per box. A form is
"changed" when any field differs from what the server rendered (`defaultValue`, `defaultChecked`, `defaultSelected`,
or `data-default` for widgets that control their own value, like photo pickers). While anything is changed, the bar
at the bottom offers Save (every changed form, in page order) and Revert, and leaving the page is blocked: links and
the browser Back button make the bar flash and shake, and closing the tab shows the browser's own warning. Forms that
create something new (`ActionForm` with an "Add" button) and delete buttons still act immediately.
Picking or uploading a file always goes through the library, with pictures, not file names
(`_components/library-picker.tsx`). `LibraryPicker` is a grid of the media library with search (file name, alt text,
description, album) and filters (`media-filters.tsx`, shared with the Media library page: type, album, season, used or
not, order); it's also where new files are uploaded, and each is picked automatically once it's in. It's used for
single images (`MediaField`: season photo, logos; people's photos), PDFs (`DocumentField`: notebook, Strategic Plan,
resources) and, ticking several, to add photos to an album: clicking an album's drop box opens it, while dropping files
on the box still uploads them straight in. `AlbumPicker` / `AlbumField` choose a whole album from cards with covers
(**Photos come from** on robots and events).

**Where a file is used** (`src/lib/media-usage.ts`) is worked out from every column that points at media (albums and
the robots and events using them, covers, robots, seasons, sponsors, people, resources, the Strategic Plan, event
videos). The Media library shows it on each file and in its delete confirmation, and the "Not used anywhere" filter
uses it. Keep it in step when adding a new media column (and `mergeMedia` in `admin/media/actions.ts`).

**Duplicates.** Before uploading, the browser fingerprints each file (`_components/fingerprint.ts`): SHA-256 of the file
as picked, and for photos a 64-bit difference hash plus the average colour (`media.sha256`, `media.phash`, migration
0015). `findDuplicate()` checks the library first: the same bytes, or a photo whose hash is at most 5 bits away with the
same colour and shape (`src/lib/phash.ts`); four expression indexes on quarters of the hash find candidates without
scanning. On a match the existing file is used (and put in the album), and the uploader offers "Upload mine anyway".
**Media library → Find duplicates** (`/admin/media/duplicates`) fingerprints older photos from their thumbnails in the
browser, groups copies (`src/lib/duplicates.ts`), and merges a group: the kept file replaces the copies in every
column above, then the copies are deleted from D1 and R2. "They're different photos" is remembered in `media_distinct`.

Lists all work one way (`src/app/admin/_components/items.tsx`): every item is a row you click anywhere on. Small
things (a sponsor, resource, photo, contact, message, match) open a popup with its own Save (`ModalItem` /
`FormModal`, ✎ on the row); things with their own lists (a season, robot, event, album, impact event) open their own
page (`LinkRow`, → on the row). Adding is a **+ Add …** button at the top of the list (`AddButton`). Delete is the
last thing inside, in red, and asks first: in a popup's footer, or a `DeletePanel` at the end of a page. Tiny lists
(sponsor tiers, subteams) are edited in place, with a trash button per row. The one exception is a scouting team's
admin page, a review screen that shows every entry and version at once. Confirmations use the site's own dialog (`useConfirm()` from
`_components/modal.tsx`, also used by any button with a `confirm` prop) instead of the browser's.

### Admin security rules

- Every admin **page** calls `requireAdminPage()` first. Next renders pages in parallel with layouts, so the layout's
  sign-in screen alone would not stop a page from streaming its data.
- Every admin **Server Action** goes through `adminAction()` (or calls `requireAdmin()`), and so do the upload and
  export routes.
- Uploaded files are served with `Content-Security-Policy: sandbox` and `nosniff`, so an uploaded SVG or PDF can't
  run script on the site.

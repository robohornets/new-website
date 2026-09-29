# btwrobotics.com

The website for **FRC Team 1209 - RoboHornets** (Booker T. Washington High School, Tulsa).

- **Next.js 16 + TypeScript + Tailwind 4**, deployed as a **Cloudflare Worker** with [OpenNext](https://opennext.js.org/cloudflare)
- **D1** (SQLite) holds every piece of site content
- **R2** holds every uploaded photo, video and logo, stored once exactly as uploaded
- **Cloudflare Images** (transformations) resizes photos on the fly for each spot on the site
- **Cloudflare Access** protects the `/admin` panel, where the team updates the site without touching code

The design lives on the canvas at https://claude.ai/artifact/LohXt4TmvEyeQAZ4nF1DWw.

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

### 3. Create the tables and starter content in D1

The D1 database (`0a483600-2eec-4bff-a8d3-739fcb5b1962`) is already set in `wrangler.jsonc`.

```bash
npm run db:migrate:remote
```

This runs `migrations/0001_initial.sql` (the schema), `migrations/0002_seed_content.sql` (text, contacts,
socials, the 2024–2026 robots and the old news and outreach posts from the previous site) and any later
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
| Build season | **Seasons → (year)** | Add the robot: name, specs (`Label: value` per line), tags, GitHub link, photo. Set status to *Build season*. |
| End of season | **Seasons → (year)** | Upload the engineering notebook PDF (or paste a link) under *Season basics*. |
| Before events | nothing | Events 1209 registers for appear from The Blue Alliance on their own. Upcoming ones show on the homepage, with a **Watch live** banner during the event. |
| During/after events | **Seasons → (year) → event** | Results and every match fill in automatically. Fix anything (it's marked **Edited**), add a write-up, highlight video or album, or hide an event/match. |
| Anytime | **Team roster** | Add or remove people and set roles. Students show publicly as "First L." and their photos stay hidden unless *Show photo* is on. |
| Anytime | **News & outreach**, **Gallery**, **Sponsors** | Posts (Markdown), photo albums (drag and drop many at once), sponsor tiers per season. |
| When it changes | **Site text & links** | Mission, values and the Strategic Plan (PDF or link) on the Team page. |
| Rarely | **Site text & links** | Homepage hero, stats, about text, socials, contact people, footer links, donate link. |
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
src/app/(site)/        public pages (home, team, seasons, news, outreach, gallery, sponsors, contact)
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

- `seasons`: year (PK), game name, summary, status (`pre_kickoff` / `build` / `competition` / `offseason`), kickoff date, reveal video, hero photo, engineering notebook (uploaded PDF and/or link), `is_current` (at most one)
- `robots`: per season: name, kind (competition / kitbot / …), description, specs JSON, tags JSON, code and CAD links, photo
- `events`: per season: name, kind, location, dates, website, webcast, Blue Alliance key, rank, record, alliance,
  playoff result, awards, plus admin-only extras (write-up, highlight video, album, hidden). `tba` holds the latest
  TBA values and `overrides` lists the fields an admin changed; syncing only writes fields not in that list.
- `matches`: per event: round, teams on each alliance, scores, our side, result, video, hidden, with the same
  `tba`/`overrides` pair
- `tba_cache`: the last ETag for each TBA request, so unchanged data is skipped
- `people` + `roster_entries`: a person exists once; a roster entry puts them on a season with a role, subteam and leadership flag. This is how the roster carries over year to year.
- `sponsors` + `sponsor_tiers` + `sponsor_seasons`: sponsors are stored once; each season lists who sponsored it and at what tier
- `posts`: news and outreach articles in Markdown (raw HTML is not rendered), optionally tied to a season
- `albums` + `album_photos`: gallery albums, optionally tied to a season
- `media`: every file uploaded to R2 (key, original filename, type, size, pixel width/height, alt text). Other tables point at it by id.
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
- Videos (MP4/MOV/WebM, up to 95 MB) are served straight from R2 with range requests, so they stream and seek.
  For long videos like full matches, upload to the team YouTube channel and link it instead.

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

### Admin security rules

- Every admin **page** calls `requireAdminPage()` first. Next renders pages in parallel with layouts, so the layout's
  sign-in screen alone would not stop a page from streaming its data.
- Every admin **Server Action** goes through `adminAction()` (or calls `requireAdmin()`), and so do the upload and
  export routes.
- Uploaded files are served with `Content-Security-Policy: sandbox` and `nosniff`, so an uploaded SVG or PDF can't
  run script on the site.

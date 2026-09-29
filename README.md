# btwrobotics.com

The website for **FRC Team 1209, the RoboHornets** (Booker T. Washington High School, Tulsa).

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

### 5. Pick a Workers plan

The **Workers Free** plan caps each request at 10 ms of CPU. Rendering a Next.js page usually takes 10–30 ms, so
some page loads on Free will fail with error 1102. **Workers Paid ($5/month)** raises the cap to 30 s and includes
10 million requests a month, which is plenty for this site. Upgrade under **Workers & Pages → Plans**.

Images transformations need no setup: the free Images plan includes 5,000 unique transformations a month (see
[Photos and videos](#photos-and-videos)).

### 6. Deploy

```bash
npm run deploy
```

`wrangler.jsonc` attaches the Worker to `btwrobotics.com` as a custom domain. If `btwrobotics.com` still has old DNS
records (A/CNAME for the old host), delete them first in **DNS → Records**, or the deploy will refuse to take the
domain.

---

## Local development

```bash
npm run db:migrate:local   # creates a local D1 in .wrangler/ with the starter content
npm run dev                # http://localhost:3000
```

Under `npm run dev`, `/admin` is open without Access (you're signed in as `dev@localhost`) and uploads go to a local
R2 emulation. To try the real Worker runtime locally, run `npm run preview`. The admin is locked there unless the
Access vars are set.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run cf-typegen` (rerun after changing `wrangler.jsonc`).

---

## Updating the site each year

Everything is in **btwrobotics.com/admin**:

| When | Where | What |
| --- | --- | --- |
| Before or at kickoff | **Seasons → Start new season** | Year, game name, kickoff date. Carries over returning students (skips anyone whose graduation year has passed), mentors and sponsors, and makes it the homepage's current season. |
| Build season | **Seasons → (year)** | Add the robot: name, specs (`Label: value` per line), tags, GitHub link, photo. Set status to *Build season*. |
| Before events | **Seasons → (year) → Competitions** | Add each regional with dates and its Blue Alliance key. Upcoming ones appear on the homepage. |
| After events | same place | Rank, record and awards. |
| Anytime | **Team roster** | Add or remove people and set roles. Students show publicly as "First L." and their photos stay hidden unless *Show photo* is on. |
| Anytime | **News & outreach**, **Gallery**, **Sponsors** | Posts (Markdown), photo albums (drag and drop many at once), sponsor tiers per season. |
| Rarely | **Site text & links** | Homepage hero, stats, about text, socials, contact people, footer links, donate link. |
| Always | **Messages** | Contact form submissions. |

Older seasons stay browsable at `/seasons/<year>` with their robot, events, roster, sponsors and photos.

---

## How it's built

```
src/app/(site)/        public pages (home, team, seasons, news, outreach, gallery, sponsors, contact)
src/app/admin/         admin panel: pages, server actions, api/upload
src/app/media/[...key] serves R2 originals, and resized copies via the Images binding
src/lib/               db helpers, data queries, Cloudflare Access auth, types
migrations/            D1 schema and seed data
wrangler.jsonc         Worker config: D1, R2, Access vars, custom domain
open-next.config.ts    OpenNext adapter config
```

Every page reads D1 per request (`src/lib/cf.ts` calls `connection()`), so admin changes are live right away and
no ISR cache bucket is needed.

### Database schema

Content is organised around **seasons**. Each FRC year is a row, and most other content hangs off it:

- `seasons`: year (PK), game name, summary, status (`pre_kickoff` / `build` / `competition` / `offseason`), kickoff date, reveal video, hero photo, `is_current` (at most one)
- `robots`: per season: name, kind (competition / kitbot / …), description, specs JSON, tags JSON, code and CAD links, photo
- `events`: per season: name, kind, location, dates, Blue Alliance key, rank, record, awards
- `people` + `roster_entries`: a person exists once; a roster entry puts them on a season with a role, subteam and leadership flag. This is how the roster carries over year to year.
- `sponsors` + `sponsor_tiers` + `sponsor_seasons`: sponsors are stored once; each season lists who sponsored it and at what tier
- `posts`: news and outreach articles in Markdown (raw HTML is not rendered), optionally tied to a season
- `albums` + `album_photos`: gallery albums, optionally tied to a season
- `media`: every file uploaded to R2 (key, original filename, type, size, pixel width/height, alt text). Other tables point at it by id.
- `site_settings`: key/value JSON for editable page text
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

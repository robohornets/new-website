# btwrobotics.com

The website for **FRC Team 1209, the RoboHornets** (Booker T. Washington High School, Tulsa).

- **Next.js 16 + TypeScript + Tailwind 4**, deployed as a **Cloudflare Worker** with [OpenNext](https://opennext.js.org/cloudflare)
- **D1** (SQLite) holds every piece of site content
- **R2** holds uploaded photos and logos
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

This runs `migrations/0001_initial.sql` (the schema) and `migrations/0002_seed_content.sql` (text, contacts,
socials, the 2024–2026 robots and the old news and outreach posts from the previous site). Wrangler tracks which
migrations have run, so this is safe to rerun.

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

### 5. Deploy

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
src/app/media/[...key] streams files out of R2 with long cache headers
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
- `media`: every file uploaded to R2 (key, type, size, alt text). Other tables point at it by id.
- `site_settings`: key/value JSON for editable page text
- `contacts`: people listed on the Contact page
- `messages`: contact form submissions (the sender IP is stored only as a hash, for rate limiting)
- `audit_log`: who changed what in the admin

### Admin security rules

- Every admin **page** calls `requireAdminPage()` first. Next renders pages in parallel with layouts, so the layout's
  sign-in screen alone would not stop a page from streaming its data.
- Every admin **Server Action** goes through `adminAction()` (or calls `requireAdmin()`), and so does the upload route.
- Uploaded files are served with `Content-Security-Policy: sandbox` and `nosniff`, so an uploaded SVG or PDF can't
  run script on the site.

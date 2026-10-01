// Step-by-step help for the admin, shown in the Help panel.
// Write for someone who has never used the admin: short steps, the exact
// button names in **bold** (as they appear on screen), no jargon.
// `pages` are the admin paths a guide belongs to; "/admin" alone means the
// dashboard only, anything else also matches the pages under it.

export type Guide = {
  id: string;
  group: "Start here" | "Season basics" | "Photos" | "People & sponsors" | "Outreach" | "Site text" | "Scouting";
  title: string;
  pages: string[];
  steps: string[];
  tips?: string[];
};

export const GROUPS: Guide["group"][] = ["Start here", "Season basics", "Photos", "People & sponsors", "Outreach", "Site text", "Scouting"];

export const GUIDES: Guide[] = [
  // ---- Start here ------------------------------------------------------------
  {
    id: "how-it-works",
    group: "Start here",
    title: "How the admin works",
    pages: ["/admin"],
    steps: [
      "Everything on btwrobotics.com comes from this admin. You never need to touch code.",
      "Use the menu on the left to pick what to change. On a phone, tap **Open admin menu** at the top.",
      "Change as many boxes on a page as you like. A bar pops up at the bottom saying **Save your changes**.",
      "Click **Save changes** in that bar to save everything at once, or **Revert** to put it all back. Nothing changes on the site until you save. (Ctrl+S or Cmd+S saves too.)",
      "Adding something new (like **Add to roster** or **Add sponsor**) and deleting still happen straight away with their own buttons.",
      "Every list works the same way: click anything in it to open it. Rows with a ✎ open a popup; rows with a → open their own page. **+ Add …** is always at the top of the list, and **Delete** is always the last thing inside, in red, and asks first.",
      "If you try to leave a page with unsaved changes, the bar flashes red and shakes. Save or revert first.",
      "Click **View site** (top right of the dashboard) to check how it looks.",
    ],
    tips: [
      "Deleting always asks you to confirm first, and can't be undone. If you're unsure, hide things instead of deleting them.",
      "Press the **? Help** button on any page to see the guides for that page.",
    ],
  },

  // ---- Season basics -----------------------------------------------------------
  {
    id: "new-season",
    group: "Season basics",
    title: "Start a new season",
    pages: ["/admin", "/admin/seasons"],
    steps: [
      "Go to **Seasons, robots & events** and click **Start 2027 season** (the year changes to whatever's next). The dashboard has the same button.",
      "Check the **Season year**. Type the **Game name** if you know it; you can add it after kickoff.",
      "Leave the **Carry over** boxes ticked to bring returning students, mentors and sponsors with you. Anyone whose graduation year has passed is left off.",
      "Keep **Make this the current season on the homepage right away** ticked so the homepage switches to the new year.",
      "Click **Create season**. You land on the new season's page, where you add the robot and events.",
    ],
    tips: ["Last season isn't changed or lost. It moves to the Seasons archive with its robot, results, roster and photos."],
  },
  {
    id: "robot",
    group: "Season basics",
    title: "Add the robot and its photos",
    pages: ["/admin/seasons/", "/admin/robots"],
    steps: [
      "Open **Seasons, robots & events** and click the season.",
      "Under **Robots**, click **+ Add robot**, type its name, pick the type and click **Add robot**. Its page opens.",
      "Under **Photos**, drop in as many photos as you like. The first upload makes an album for them (\"2026 robot: Roomba\"), which also shows in the Gallery. Already have them in an album? Pick it in **Photos come from** instead.",
      "The photos are a slideshow at the top of the season page, in the order shown: drag them by **⠿** (or use **◀ ▶**) and save. Click a photo to describe it or **Make main photo** (used on the homepage and lists).",
      "Under **Details**, fill in the description, tags, code and CAD links, and **Specs** (one per line as Label: value, for example Drivetrain: Swerve), then click **Save changes** in the bar at the bottom.",
    ],
    tips: [
      "The first competition robot is the one featured on the homepage and season page. Use **Order** (lower numbers first) to change which one comes first.",
      "The code and CAD links are listed on the season's Resources tab automatically.",
    ],
  },
  {
    id: "tba-results",
    group: "Season basics",
    title: "Competition results (The Blue Alliance)",
    pages: ["/admin/seasons/", "/admin/events"],
    steps: [
      "You don't need to type in results. Every event 1209 is registered for comes in from The Blue Alliance (TBA) on its own, with rank, record, alliance, playoff result, awards and every match.",
      "During an event it updates about every 15 minutes. The rest of the time it checks once a day.",
      "To update right now, open the season and click **Sync now** (the button shows the season's year, like Sync 2027 now), or open an event and click **Sync from TBA now**.",
      "Click an event in the **Competitions & events** list to see everything about it.",
    ],
    tips: ["TBA usually posts results within a few minutes of each match. If something looks wrong, fix it yourself with an override (see the next guide)."],
  },
  {
    id: "override",
    group: "Season basics",
    title: "Fix a result or a match (override TBA)",
    pages: ["/admin/events"],
    steps: [
      "Open the event. Each box shows what the public site shows. Under it, **The Blue Alliance says** shows TBA's value.",
      "Change any box (rank, awards, webcast link, anything) and click **Save changes** in the bar at the bottom.",
      "That box gets a rust outline and an **EDITED** badge. The site now shows your value, and syncing will never change it.",
      "To undo, click **Reset to TBA** under that box. **Reset all to TBA** at the top undoes every edit on the event.",
      "Matches work the same way: in **Matches**, click a match, change the score, teams, result or video, and click **Save**.",
    ],
    tips: ["Typing TBA's exact value back into a box also removes the override."],
  },
  {
    id: "competition-day",
    group: "Season basics",
    title: "What the homepage shows during a competition",
    pages: ["/admin/events", "/admin/seasons"],
    steps: [
      "While an event with a Blue Alliance key is on, a **LIVE NOW** card sits above the homepage's hero. You don't need to do anything.",
      "It shows our **Next match** (with the time The Blue Alliance predicts and how long until it starts), who's on our alliance and who we're against, our rank and record, and the **Last match** result.",
      "It checks for news every minute by itself, so people can leave the homepage open all day.",
      "**Watch live** uses the event's webcast link. If it's missing or wrong, fix **Webcast link** on the event's page.",
      "Once we're knocked out (or win), it says so. The card goes away on its own after the event's last day.",
    ],
    tips: ["Events without a Blue Alliance key (a scrimmage, a demo) get a plain LIVE NOW banner instead, with no matches."],
  },
  {
    id: "event-extras",
    group: "Season basics",
    title: "Add a write-up, highlight video or photos to an event",
    pages: ["/admin/events"],
    steps: [
      "Open the event and scroll to **Extras on the event page**.",
      "**Write-up**: a few sentences about how the event went. It shows near the top of the event page.",
      "**Highlight video**: paste a YouTube link. For a video you uploaded, copy its **Open** link from the Media library and paste that.",
      "**Photo album**: pick the album with this event's photos (make albums under **Gallery** first).",
      "Click **Save changes** in the bar at the bottom.",
      "To swap in a different video for a single match, open the match and change **Video link**.",
    ],
  },
  {
    id: "hide",
    group: "Season basics",
    title: "Hide an event or a match",
    pages: ["/admin/events"],
    steps: [
      "Open the event, tick **Hide this event from the site**, and click **Save changes**. It keeps syncing here but disappears from the public site.",
      "To hide one match, click it, tick **Hide this match from the site**, and click **Save**.",
      "**Hide all** and **Show all** above the match list do every match at once.",
    ],
    tips: ["Don't delete events that come from TBA: they come back on the next sync. Hide them instead."],
  },
  {
    id: "manual-event",
    group: "Season basics",
    title: "Add an event that isn't on The Blue Alliance",
    pages: ["/admin/seasons/"],
    steps: [
      "Open the season and click **+ Add event** under **Competitions & events**.",
      "Fill in the name, type, dates and location, then click **Add event**.",
      "You're taken to the event's page. Type in any results, and use **+ Add match** if you want matches listed.",
    ],
  },
  {
    id: "notebook",
    group: "Season basics",
    title: "Add the engineering notebook",
    pages: ["/admin/seasons/"],
    steps: [
      "Open **Seasons, robots & events** and click the season.",
      "In **Season basics**, find **Engineering notebook**.",
      "Click **Upload PDF** and pick the notebook. It can be up to 95 MB. Or, if it lives in Google Drive, paste its link into **Or a link instead**.",
      "Click **Save changes** in the bar at the bottom. An **Engineering notebook** button appears on that season's page, and the notebook is listed on the Team page.",
    ],
    tips: [
      "If you use a Google Drive link, set sharing to **Anyone with the link** first, or visitors will see a request-access page.",
      "If both a PDF and a link are filled in, the site uses the PDF. Click **Remove** to go back to the link.",
    ],
  },
  {
    id: "history",
    group: "Season basics",
    title: "Import the team's history",
    pages: ["/admin/seasons"],
    steps: [
      "Go to **Seasons, robots & events**.",
      "In **Team history from The Blue Alliance**, click **Import all past seasons from TBA**.",
      "Leave the page open until the list says **Done** (usually a minute or two). Each season appears as it's imported.",
    ],
    tips: ["It's safe to run again: it only fills in and updates, and never overwrites anything you've edited."],
  },

  {
    id: "resources",
    group: "Season basics",
    title: "Add resources for other teams",
    pages: ["/admin/seasons/"],
    steps: [
      "Open the season. **Resources** lists what's on the season page's Resources tab.",
      "Some are filled in for you (marked **Auto**): each robot's code and CAD links, the engineering notebook, the scouting data once it's public, and the Strategic Plan. Click one to go to where it's changed.",
      "Click **+ Add resource** for anything else: a title, one sentence about it, and a link or an uploaded PDF. Then click **Add resource**.",
      "Tick **Show on every season** for team documents like the branding guidelines; they show on every season's Resources tab.",
      "Click a resource to change or delete it.",
    ],
    tips: ["Send judges and other teams the address of the tab itself, like btwrobotics.com/seasons/2026/resources."],
  },

  // ---- Photos ----------------------------------------------------------------
  {
    id: "upload-photos",
    group: "Photos",
    title: "Upload photos to an album",
    pages: ["/admin/gallery", "/admin/media"],
    steps: [
      "Go to **Gallery**, click **+ New album**, type a title (for example the event name), pick the season, and click **Create album**.",
      "Drag photos from your computer into the dashed box, or click the box to choose them. You can pick lots at once.",
      "Wait for **Uploading 12 of 12…** to finish. The photos then appear below.",
      "Photos straight from a phone are fine (up to 20 MB each, including iPhone HEIC). Videos work too: they're converted to MP4 in your browser first so every browser can play them (keep the tab open while it says **Converting**).",
    ],
    tips: ["Each photo is kept exactly as uploaded. The site makes smaller copies automatically so pages load fast."],
  },
  {
    id: "photo-details",
    group: "Photos",
    title: "Descriptions, alt text and the cover photo",
    pages: ["/admin/gallery/", "/admin/robots"],
    steps: [
      "Open the album and click a photo. A popup opens with it large, and you can fill in:",
      "**Description**: shown when someone opens the photo on the site. Optional; a sentence about what's happening is plenty.",
      "**Alt text**: one sentence describing the photo for people using screen readers, like Drive team celebrating after a win.",
      "Use **‹ ›** (or the arrow keys) to go to the next photo; what you typed is saved as you go.",
      "Then click **Save changes** in the bar at the bottom (you can do several photos first).",
      "**Make cover** makes that photo represent the album.",
      "**Remove from album** takes a photo out of the album but keeps it in the Media library.",
    ],
  },
  {
    id: "reorder-gallery",
    group: "Photos",
    title: "Put albums and photos in order",
    pages: ["/admin/gallery"],
    steps: [
      "Go to **Gallery**. Albums are listed in the order the site shows them, on the Gallery page and each season's page. New albums start at the front.",
      "Drag an album by its **⠿** handle to where it should go. On a phone or tablet, use the **◀** and **▶** buttons instead.",
      "Click **Save changes** in the bar at the bottom, or **Revert** to put them back.",
      "Inside an album, photos work the same way: drag them by **⠿** (or use **◀ ▶**) and save. New uploads go at the end.",
    ],
    tips: ["Drag photos into order, then click **Save changes** in the bar at the bottom. Descriptions are saved in their own popup."],
  },
  {
    id: "delete-file",
    group: "Photos",
    title: "Delete a photo for good",
    pages: ["/admin/media"],
    steps: [
      "Go to **Media library** and click the file.",
      "Click **Delete file** at the bottom of the popup and confirm. It's removed everywhere it was used.",
    ],
    tips: ["This can't be undone. Click **Download original** first if you might want it later."],
  },

  // ---- People & sponsors ---------------------------------------------------------
  {
    id: "add-person",
    group: "People & sponsors",
    title: "Add someone to the roster",
    pages: ["/admin/roster"],
    steps: [
      "Go to **Team roster** and make sure the right season is highlighted at the top.",
      "Click **Add person**. A popup opens.",
      "For someone new, fill in their name, pick **Student** or **Mentor / teacher sponsor**, and add their **Graduation year**, **Role** and **Main subteam**. You can add a photo here too.",
      "Someone who was on an earlier season? Click **Someone from another season** at the top of the popup and pick them, so they aren't added twice.",
      "Click **Add to roster**.",
    ],
  },
  {
    id: "privacy",
    group: "People & sponsors",
    title: "Student privacy rules",
    pages: ["/admin/roster", "/admin/people"],
    steps: [
      "Students always appear on the site as their first name and last initial (Alex M.). You can type the full last name; it's never shown.",
      "Student photos are hidden unless **Show photo on the public site** is ticked. Only tick it if you have permission.",
      "Mentors and teacher sponsors are shown with their full name and photo.",
      "A **Short bio** is public: clicking someone's card on the Team page shows it. Leave it blank if they'd rather not.",
      "People without a photo (or with it hidden) show their initials on a colored circle instead.",
    ],
  },
  {
    id: "edit-person",
    group: "People & sponsors",
    title: "Change someone's details or remove them",
    pages: ["/admin/roster", "/admin/people"],
    steps: [
      "On **Team roster**, click their card. A popup opens with everything about them.",
      "Change what you need: name, class, bio, role, main subteam, other subteams (**Also on**), **Leadership** or order. Then click **Save**.",
      "**Cancel** closes without saving (it asks first if you changed something).",
      "**Remove from 2026** (the red button at the bottom of the popup) takes them off this season only, after you confirm. Earlier seasons keep them.",
    ],
    tips: ["Keep graduation years up to date: seniors are then left off automatically when you start a new season."],
  },
  {
    id: "roster-find",
    group: "People & sponsors",
    title: "Find people and manage photos",
    pages: ["/admin/roster"],
    steps: [
      "Type in **Search by name** to find someone. The dropdowns next to it show only one subteam, one class, or only leadership. **Clear** shows everyone again.",
      "To add a photo, click their card, then **Add photo** (or **Replace photo**) and pick a picture. **Remove photo** takes it off.",
      "**Show photo on the public site** decides whether the photo appears on the Team page. Untick it to hide the photo but keep it here. Cards say **Photo hidden on the site** when it's off.",
      "Click **Save** in the popup.",
    ],
    tips: ["Only show student photos when you have permission."],
  },
  {
    id: "subteams",
    group: "People & sponsors",
    title: "Change the list of subteams",
    pages: ["/admin/roster"],
    steps: [
      "On **Team roster**, click **Manage subteams**. Everyone's subteam dropdown and the join form use this list.",
      "To add one, type it in **New subteam** and click **Add**.",
      "Rename a subteam or change its order (lower shows first), then click **Save changes**. Everyone on it moves with the new name.",
      "Tick **Private** for subteams students can't pick on the join form, like Drive Team. Only an admin can put someone on a private subteam. It still shows on the public roster.",
      "**Delete** removes a subteam after you confirm. People on it stay on the roster with no subteam.",
    ],
  },
  {
    id: "join-requests",
    group: "People & sponsors",
    title: "Let students ask to join",
    pages: ["/admin", "/admin/join"],
    steps: [
      "Go to **Join requests** and tick **Accept join requests**, then click **Save changes**. The form is off until you do this.",
      "Click **Copy link** and share it (group chat, interest meeting slides). The form isn't linked anywhere on the site.",
      "Students give their name and graduation year, drag the subteams into the order they want, and write a little about themselves.",
      "New requests show under **Pending**. Click one to read it. The **Subteam** box starts as their first choice; change it if you like (they never see it).",
      "Click **Add to roster** to put them on this season's roster straight away, or **Decline**.",
      "When recruiting is over, untick **Accept join requests** and save.",
    ],
    tips: [
      "Added and declined requests move to their own tabs so you can still read them. **Move back to Pending** undoes a decline.",
      "If a student sends the form twice with the same name, their pending request is updated instead of added twice.",
      "Private subteams (like Drive Team) aren't shown on the form, but you can still pick them when adding someone.",
    ],
  },
  {
    id: "add-sponsor",
    group: "People & sponsors",
    title: "Add a sponsor",
    pages: ["/admin/sponsors"],
    steps: [
      "Go to **Sponsors** and pick the season at the top.",
      "Click **+ Add sponsor**, then type the name and website.",
      "Pick their tier for this season (Titanium, Gold…).",
      "For the **Logo**, click **Upload new**. A logo with a transparent background (PNG or SVG) looks best. Then click **Add sponsor**.",
    ],
  },
  {
    id: "sponsor-lineup",
    group: "People & sponsors",
    title: "Change this season's sponsors and tiers",
    pages: ["/admin/sponsors"],
    steps: [
      "Go to **Sponsors** and pick the season at the top.",
      "Each sponsor in **Sponsors** shows their tier for that season (or **Not in** that year). Click a sponsor to open it.",
      "Pick their tier in the **tier** box, or **Not this season** if they aren't sponsoring this year. **Order within tier** decides who comes first among sponsors in the same tier.",
      "Click **Save changes** in the bar at the bottom. You can change several sponsors and save them all at once.",
      "To rename tiers or change their order, use the **Tiers** box. Lower rank shows first and gets the big logos.",
    ],
    tips: ["When you start a new season, last season's sponsors are copied over. Update their tiers once you know who's renewing."],
  },

  // ---- Site text -------------------------------------------------------------
  {
    id: "stats",
    group: "Site text",
    title: "Change the numbers on the homepage",
    pages: ["/admin/settings"],
    steps: [
      "Go to **Site text & links** and find **Stats strip**.",
      "Each line is one number: the number, a | bar, then the words under it. For example: 2002 | Year the team was founded",
      "For the member count, type **{members}** instead of a number. The site counts the students on this season's roster and rounds down to the nearest 10, so 42 students shows as 40+.",
      "Click **Save changes** in the bar at the bottom.",
    ],
    tips: ["Only the count is shown. The roster itself stays on the Team page, with students as first name and last initial."],
  },
  {
    id: "calendar",
    group: "Site text",
    title: "Show the team calendar",
    pages: ["/admin/settings"],
    steps: [
      "The Team page lists the next two months from the team's Google Calendar (meetings, outreach, competitions). Add and change events in Google Calendar as usual; the site picks them up within about 10 minutes.",
      "The calendar has to be public. In Google Calendar, open Settings, click the calendar on the left, and under Access permissions tick Make available to public.",
      "To use a different calendar, go to Site text & links and change **Google Calendar ID** under **Calendar** (it's usually the Gmail address), then click **Save changes**. Leave it blank to hide the calendar.",
    ],
    tips: ["Anything on the calendar is public, including the description, so keep private details out of events."],
  },
  {
    id: "mission-values",
    group: "Site text",
    title: "Change the mission or values",
    pages: ["/admin/settings"],
    steps: [
      "Go to **Site text & links**.",
      "Edit the words in **Mission statement**.",
      "Below it, **Values** has a card for each value (the six FIRST Core Values to start). Change a **Name** or **Text**.",
      "Click **Save changes** in the bar at the bottom.",
      "To remove a value, clear its **Name**. To add one, fill in an empty card.",
    ],
    tips: ["Both show near the top of the Team page. Leave the mission blank to hide it."],
  },
  {
    id: "strategic-plan",
    group: "Site text",
    title: "Update the Strategic Plan",
    pages: ["/admin/settings"],
    steps: [
      "Go to **Site text & links** and scroll to **Strategic Plan**.",
      "Click **Upload PDF** (or **Replace PDF**) and pick the new plan. Or paste a link to it into **Or a link instead**.",
      "Update the **Short summary** if the plan's focus changed, and type when it was updated (like Fall 2026) into **Last updated**.",
      "Click **Save changes** in the bar at the bottom. The Team page shows the summary with a **Read the Strategic Plan** button.",
    ],
    tips: ["Clear both the PDF and the link to hide the section."],
  },

  // ---- Outreach ---------------------------------------------------------------
  {
    id: "outreach-log",
    group: "Outreach",
    title: "Log who went to an outreach event",
    pages: ["/admin/outreach", "/admin/events"],
    steps: [
      "Go to **Outreach hours** and check the season at the top.",
      "New event? Click **+ Add outreach event**, fill in the name, date, **How long (hours)**, and **People reached** if you know it, and click **Add and log who went**. For one that's already listed, click it.",
      "Under **Who went**, tick everyone who helped. Students and mentors from this season's roster are listed. **Find someone** narrows the list, and **Tick everyone** / **Clear all** work on whoever is shown.",
      "Everyone ticked gets the event's **How long**. For someone who left early or stayed late, type their own hours in the box next to their name (1.5 or 1:30 both work).",
      "Add a sentence under **What we did** if you like, then click **Save changes** in the bar at the bottom.",
    ],
    tips: [
      "Change **How long** later and everyone without their own hours changes with it.",
      "You can log people before an event happens; it only counts toward the totals once it has started.",
    ],
  },
  {
    id: "outreach-totals",
    group: "Outreach",
    title: "See and share outreach totals",
    pages: ["/admin/outreach"],
    steps: [
      "The four numbers at the top of **Outreach hours** are the season's volunteer hours, outreach events, people reached and how many team members helped.",
      "The Impact page on the site shows the latest season's hours, events and people reached, then every outreach event with its **What we did** write-up (and the cover of its photo album, if it has one). It never shows who went or anyone's own hours.",
      "**Hours by person** lists everyone's total, most hours first. It's only in the admin.",
      "**Download totals (CSV)** gives one line per person; **Download full log (CSV)** gives one line per person per event. Both open in Excel or Google Sheets, handy for service-hour forms, letters of recommendation and the Impact Award.",
    ],
  },

  // ---- Scouting ---------------------------------------------------------------
  {
    id: "scouting-form",
    group: "Scouting",
    title: "Set up scouting for a new game",
    pages: ["/admin/scouting"],
    steps: [
      "After kickoff, go to **Scouting** and check the season at the top is the new one.",
      "Under the form, click the **Copy the … form** button to reuse last year's questions, or **Start from the example form**.",
      "**Robot questions** are what you ask a team in their pit (drivetrain, weight, what they can score). Each team has one shared sheet anyone can update.",
      "**Match report** is filled in while watching one of their matches. A team can have as many reports as you like.",
      "Rename questions for this year's game, change options, use ↑ ↓ to reorder, and **+ Counter**, **+ Yes / no**, **+ Pick one** and the others to add more. **Heading** splits the form into parts like Autonomous and Endgame.",
      "Click **Save changes** in the bar at the bottom.",
    ],
    tips: [
      "Removing a question hides it but keeps the answers people gave. Adding it back brings them back.",
      "Counters get big − and + buttons on phones, so they're best for things you count during a match.",
    ],
  },
  {
    id: "scouting-open",
    group: "Scouting",
    title: "Open scouting for an event",
    pages: ["/admin/scouting"],
    steps: [
      "On **Scouting**, tick **Open /scouting** and click **Save changes**.",
      "Click **Copy link** and share it with your scouts. It isn't linked anywhere on the site. Anyone with the link can add to it, including other teams.",
      "Have everyone open the link once with signal (hotel Wi-Fi, before the event). After that it works in the stands with no signal: what they save waits on the phone and uploads by itself when signal comes back.",
      "Teams at your events come from The Blue Alliance, with their rank, record, OPR and matches. Scouts can also type any team number.",
      "Untick **Open /scouting** at the end of the season.",
    ],
  },
  {
    id: "scouting-publish",
    group: "Scouting",
    title: "Show scouting on the season page",
    pages: ["/admin/scouting"],
    steps: [
      "On **Scouting**, check the season at the top, then look through the results at the bottom first: once it's public, everyone can read every note.",
      "Under **On the season page**, tick **Show 2026 scouting on the season page** and click **Save changes**.",
      "The season page gets a **Scouting** tab listing every team scouted, with their robot sheet and every match report. Scouts' names aren't shown, and there's no link to add more.",
      "Untick it to take the tab down again.",
    ],
  },
  {
    id: "scouting-results",
    group: "Scouting",
    title: "Look at results and fix mistakes",
    pages: ["/admin/scouting"],
    steps: [
      "**Results** at the bottom of **Scouting** lists every team scouted this season. Click a team to see their robot sheet and all their reports.",
      "Anyone on /scouting can edit or delete, so every change is kept. Open **Earlier versions** under an entry and click **Restore this version** to undo a change.",
      "Deleted entries are listed under **Deleted** with a **Restore** button.",
      "**Robots CSV** and **Match reports CSV** download everything as a spreadsheet, one column per question, for pick lists.",
    ],
  },
];

function matches(page: string, pathname: string): boolean {
  if (page === "/admin") return pathname === "/admin";
  // "/admin/seasons/" means only the pages under it, like /admin/seasons/2026.
  if (page.endsWith("/")) return pathname.startsWith(page);
  return pathname === page || pathname.startsWith(`${page}/`);
}

/** Guides that belong to the admin page at `pathname`. */
export function guidesFor(pathname: string): Guide[] {
  return GUIDES.filter((g) => g.pages.some((p) => matches(p, pathname)));
}

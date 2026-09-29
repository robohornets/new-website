// Step-by-step help for the admin, shown in the Help panel.
// Write for someone who has never used the admin: short steps, the exact
// button names in **bold** (as they appear on screen), no jargon.
// `pages` are the admin paths a guide belongs to; "/admin" alone means the
// dashboard only, anything else also matches the pages under it.

export type Guide = {
  id: string;
  group: "Start here" | "Season basics" | "Photos & posts" | "People & sponsors" | "Site text";
  title: string;
  pages: string[];
  steps: string[];
  tips?: string[];
};

export const GROUPS: Guide["group"][] = ["Start here", "Season basics", "Photos & posts", "People & sponsors", "Site text"];

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
    title: "Add the robot and its photo",
    pages: ["/admin/seasons/"],
    steps: [
      "Open **Seasons, robots & events** and click **Edit** next to the season.",
      "Scroll to **Robots** and fill in the **+ Add a robot** box: name, type, and a short description.",
      "Under **Specs**, put one fact per line as Label: value, for example Drivetrain: Swerve.",
      "For **Robot photo**, click **Upload new** and pick a photo, or choose one already uploaded from **Or pick from library…**.",
      "Click **Add robot**. To change it later, click **Edit** next to the robot's name, make changes, and click **Save changes** in the bar at the bottom.",
    ],
    tips: ["The first competition robot is the one featured on the homepage. Use **Order** (lower numbers first) to change which one comes first."],
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
      "Matches work the same way: in **Matches**, click **Edit** on a match, change the score, teams, result or video, and click **Save changes**.",
    ],
    tips: ["Typing TBA's exact value back into a box also removes the override."],
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
      "To hide one match, click **Edit** on it, tick **Hide this match from the site**, and click **Save changes**.",
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
      "Open the season and click **+ Add an event by hand** under **Competitions & events**.",
      "Fill in the name, type, dates and location, then click **Add event**.",
      "You're taken to the event's page. Type in any results, and use **+ Add a match by hand** if you want matches listed.",
    ],
  },
  {
    id: "notebook",
    group: "Season basics",
    title: "Add the engineering notebook",
    pages: ["/admin/seasons/"],
    steps: [
      "Open **Seasons, robots & events** and click **Edit** next to the season.",
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

  // ---- Photos & posts ---------------------------------------------------------
  {
    id: "upload-photos",
    group: "Photos & posts",
    title: "Upload photos to an album",
    pages: ["/admin/gallery", "/admin/media"],
    steps: [
      "Go to **Gallery**. In **New album**, type a title (for example the event name), pick the season, and click **Create album**.",
      "Drag photos from your computer into the dashed box, or click the box to choose them. You can pick lots at once.",
      "Wait for **Uploading 12 of 12…** to finish. The photos then appear below.",
      "Photos straight from a phone are fine (up to 20 MB each, including iPhone HEIC). Short videos up to 95 MB work too.",
    ],
    tips: ["Each photo is kept exactly as uploaded. The site makes smaller copies automatically so pages load fast."],
  },
  {
    id: "photo-details",
    group: "Photos & posts",
    title: "Captions, alt text and the cover photo",
    pages: ["/admin/gallery/"],
    steps: [
      "Open the album. Under each photo you can fill in:",
      "**Alt text**: one sentence describing the photo for people using screen readers, like Drive team celebrating after a win.",
      "**Caption**: shown under the photo on the site.",
      "**Order**: lower numbers show first. Then click **Save changes** in the bar at the bottom (you can do several photos first).",
      "Click **Make cover** on the photo that should represent the album.",
      "**Remove** takes a photo out of the album but keeps it in the Media library.",
    ],
  },
  {
    id: "write-post",
    group: "Photos & posts",
    title: "Write a news or outreach post",
    pages: ["/admin/posts"],
    steps: [
      "Go to **News & outreach** and click **New post**.",
      "Fill in the **Title** and a one or two sentence **Summary** (shown on the post's card).",
      "Write the post in **Article**. Leave an empty line between paragraphs. Put **two stars** around words for bold, and start a line with ## for a heading.",
      "Click **Preview** to see how it will look, and **Write** to keep editing.",
      "On the right, pick **Section** (News or Outreach) and optionally the **Season** it belongs to.",
      "Tick **Published** to put it on the site now, or leave it unticked to save a draft. Then click **Create post**.",
    ],
    tips: ["Add a **Cover** image on the right: click **Upload new** or pick from the library."],
  },
  {
    id: "delete-file",
    group: "Photos & posts",
    title: "Delete a photo for good",
    pages: ["/admin/media"],
    steps: [
      "Go to **Media library** and find the file.",
      "Click **Delete file** and confirm. It's removed everywhere it was used.",
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
      "On **Team roster**, click **Edit** on their card. A popup opens with everything about them.",
      "Change what you need: name, class, bio, role, main subteam, other subteams (**Also on**), **Leadership** or order. Then click **Save**.",
      "**Cancel** closes without saving (it asks first if you changed something).",
      "**Remove** on a card takes them off this season only, after you confirm. Earlier seasons keep them.",
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
      "To add a photo, click **Edit** on their card, then **Add photo** (or **Replace photo**) and pick a picture. **Remove photo** takes it off.",
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
      "In **Add a sponsor**, type the name and website.",
      "For the **Logo**, click **Upload new**. A logo with a transparent background (PNG or SVG) looks best.",
      "Pick their tier for this season (Titanium, Gold…) and click **Add sponsor**.",
    ],
  },
  {
    id: "sponsor-lineup",
    group: "People & sponsors",
    title: "Change this season's sponsors and tiers",
    pages: ["/admin/sponsors"],
    steps: [
      "Go to **Sponsors** and pick the season at the top.",
      "In the lineup table, pick each sponsor's tier, or **Not this season** for anyone who isn't sponsoring this year.",
      "Click **Save changes** in the bar at the bottom.",
      "To rename tiers or change their order, use the **Tiers** box. Lower rank shows first and gets the big logos.",
    ],
    tips: ["When you start a new season, last season's sponsors are copied over. Update the lineup once you know who's renewing."],
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

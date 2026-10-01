export type SeasonStatus = "pre_kickoff" | "build" | "competition" | "offseason";

export const SEASON_STATUS_LABEL: Record<SeasonStatus, string> = {
  pre_kickoff: "Pre-kickoff",
  build: "Build season",
  competition: "Competition season",
  offseason: "Offseason",
};

export type Media = {
  id: number;
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  alt: string;
  uploaded_by: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type Season = {
  year: number;
  game_name: string;
  summary: string;
  status: SeasonStatus;
  kickoff_date: string | null;
  reveal_video_url: string | null;
  hero_media_id: number | null;
  hero_key: string | null;
  is_current: number;
  /** Engineering notebook: an uploaded PDF, a link, or both. */
  notebook_media_id: number | null;
  notebook_key: string | null;
  notebook_filename: string | null;
  notebook_url: string | null;
};

export type Spec = { label: string; value: string };

export type RobotKind = "competition" | "kitbot" | "offseason" | "prototype";

export type Robot = {
  id: number;
  season_year: number;
  name: string;
  kind: RobotKind;
  description: string;
  specs: Spec[];
  tags: string[];
  code_url: string | null;
  cad_url: string | null;
  /** The robot's photo before albums; still shown when it has no album. */
  photo_media_id: number | null;
  /** The album its photos come from (the season page slideshow). */
  album_id: number | null;
  /** Its main photo: the album's cover or first photo, else photo_media_id. */
  photo_key: string | null;
  sort_order: number;
  game_name?: string;
};

export type EventKind = "regional" | "district" | "championship" | "offseason" | "outreach" | "other";

export type TeamEvent = {
  id: number;
  season_year: number;
  name: string;
  kind: EventKind;
  location: string;
  start_date: string | null;
  end_date: string | null;
  tba_key: string | null;
  rank: string;
  record: string;
  awards: string;
  notes: string;
  website: string | null;
  webcast_url: string | null;
  timezone: string | null;
  alliance: string;
  playoff_result: string;
  recap: string;
  highlight_video_url: string | null;
  album_id: number | null;
  hidden: number;
  /** Latest values from The Blue Alliance (JSON). */
  tba: string | null;
  /** JSON array of field names an admin has overridden. */
  overrides: string;
  tba_synced_at: string | null;
  /** Outreach events: how long it ran (everyone logged starts with this). */
  outreach_hours: number | null;
  /** Outreach events: rough count of the public we reached. */
  people_reached: number | null;
};

export type Match = {
  id: number;
  event_id: number;
  tba_key: string | null;
  comp_level: string;
  set_number: number;
  match_number: number;
  time: number | null;
  red_teams: string;
  blue_teams: string;
  red_score: number | null;
  blue_score: number | null;
  our_alliance: "red" | "blue" | null;
  result: "win" | "loss" | "tie" | "";
  video_url: string | null;
  hidden: number;
  tba: string | null;
  overrides: string;
};

export type PersonKind = "student" | "mentor";

export type Person = {
  id: number;
  first_name: string;
  last_name: string;
  kind: PersonKind;
  bio: string;
  photo_media_id: number | null;
  photo_key: string | null;
  show_photo: number;
  graduation_year: number | null;
};

export type Subteam = { id: number; name: string; private: number; sort_order: number };

export type RosterMember = Person & {
  entry_id: number;
  role: string;
  /** Main subteam: shown on the public roster. */
  subteam_id: number | null;
  subteam: string;
  /** Other subteams they're also on this season. */
  extra_subteam_ids: number[];
  is_leadership: number;
  sort_order: number;
};

export type JoinRequestStatus = "pending" | "added" | "declined";

export type JoinRequest = {
  id: number;
  first_name: string;
  last_name: string;
  graduation_year: number;
  ranking: { id: number; name: string }[];
  about: string;
  status: JoinRequestStatus;
  assigned_subteam_id: number | null;
  person_id: number | null;
  season_year: number | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type SponsorTier = { id: number; name: string; rank: number };

export type Sponsor = {
  id: number;
  name: string;
  url: string | null;
  description: string;
  logo_media_id: number | null;
  logo_key: string | null;
};

export type SeasonSponsor = Sponsor & { tier_id: number; tier_name: string; tier_rank: number; sort_order: number };

export type Album = {
  id: number;
  slug: string;
  title: string;
  description: string;
  season_year: number | null;
  cover_media_id: number | null;
  cover_key: string | null;
  published: number;
  photo_count: number;
  created_at: string;
};

export type AlbumPhoto = {
  media_id: number;
  r2_key: string;
  content_type: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  sort_order: number;
};

export type Contact = { id: number; name: string; role: string; email: string; sort_order: number };

export type MessageTopic = "sponsorship" | "joining" | "donation" | "mentoring" | "other";

export const MESSAGE_TOPICS: { value: MessageTopic; label: string }[] = [
  { value: "sponsorship", label: "Sponsoring the team" },
  { value: "joining", label: "Joining the team" },
  { value: "donation", label: "Donating" },
  { value: "mentoring", label: "Mentoring" },
  { value: "other", label: "Something else" },
];

export type Message = {
  id: number;
  name: string;
  email: string;
  topic: MessageTopic;
  body: string;
  read_at: string | null;
  archived: number;
  created_at: string;
};

// site_settings values
export type HeroSettings = { eyebrow: string; titleTop: string; titleBottom: string; intro: string };
export type Stat = { value: string; label: string };
export type AboutSettings = { heading: string; body: string; long: string };
export type BuildStep = { title: string; when: string; body: string };
export type JoinSettings = { heading: string; body: string };
export type ContactSettings = { email: string; address: string; mapsUrl: string; intro: string };
export type SocialPlatform = "youtube" | "instagram" | "tiktok" | "x" | "github" | "facebook" | "threads";
export type Social = { platform: SocialPlatform; url: string };
export type LinkItem = { label: string; url: string };
export type CoreValue = { title: string; body: string };
/** A PDF in R2 (media_id), a link somewhere else (url), or both. */
export type StrategicPlan = { summary: string; media_id: number | null; url: string; updated: string };

export type SiteSettings = {
  hero: HeroSettings;
  stats: Stat[];
  about: AboutSettings;
  build_steps: BuildStep[];
  join: JoinSettings;
  contact: ContactSettings;
  socials: Social[];
  friend_links: LinkItem[];
  donate_url: string;
  mission: string;
  values: CoreValue[];
  strategic_plan: StrategicPlan;
  /** The /join form only accepts requests while this is on. */
  join_requests: { open: boolean };
  /** /scouting only works while this is on. */
  scouting: { open: boolean };
  /** Google Calendar ID (e.g. btwrobotics@gmail.com) or a public iCal link. Empty hides the calendar. */
  calendar: { id: string };
};

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
  photo_media_id: number | null;
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

export type RosterMember = Person & {
  entry_id: number;
  role: string;
  subteam: string;
  is_leadership: number;
  sort_order: number;
};

export type PostCategory = "news" | "outreach";

export type Post = {
  id: number;
  slug: string;
  title: string;
  category: PostCategory;
  excerpt: string;
  body: string;
  cover_media_id: number | null;
  cover_key: string | null;
  season_year: number | null;
  published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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
};

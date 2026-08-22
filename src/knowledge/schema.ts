// Core data model for the DJ knowledge layer.

/** Scenario/context tags a song can be associated with. */
export type ScenarioTag =
  | "banger"
  | "dance-floor"
  | "cocktail-dinner"
  | "wedding"
  | "car-show-party"
  | "throwback"
  | "birthday-party"
  | "college-party"
  | "prom"
  | "nightclub"
  | "house-party"
  | "pool-party"
  | "beach-party"
  | "block-party"
  | "bar-lounge"
  | "graduation"
  | "quinceanera"
  | "sweet-16"
  | "corporate-event"
  | "holiday-party"
  | "concert-festival"
  | "karaoke"
  | "sports-party"
  | "family-party"
  | "bachelor-party"
  | "bachelorette-party"
  | "fundraiser"
  | "ceremony"
  | "cocktail-hour"
  | "dinner"
  | "grand-entrance"
  | "first-dance"
  | "cake-cutting"
  | "bouquet-toss"
  | "last-dance"
  | "slow-singalong"
  | "opener"
  | "warm-up"
  | "peak-hour"
  | "cool-down"
  | "late-night"
  | "transition"
  | "dj-tool";

export const ALL_SCENARIO_TAGS: ScenarioTag[] = [
  "banger",
  "dance-floor",
  "cocktail-dinner",
  "wedding",
  "car-show-party",
  "throwback",
  "birthday-party",
  "college-party",
  "prom",
  "nightclub",
  "house-party",
  "pool-party",
  "beach-party",
  "block-party",
  "bar-lounge",
  "graduation",
  "quinceanera",
  "sweet-16",
  "corporate-event",
  "holiday-party",
  "concert-festival",
  "karaoke",
  "sports-party",
  "family-party",
  "bachelor-party",
  "bachelorette-party",
  "fundraiser",
  "ceremony",
  "cocktail-hour",
  "dinner",
  "grand-entrance",
  "first-dance",
  "cake-cutting",
  "bouquet-toss",
  "last-dance",
  "slow-singalong",
  "opener",
  "warm-up",
  "peak-hour",
  "cool-down",
  "late-night",
  "transition",
  "dj-tool",
];

/** Where in a real DJ set (by relative position, 0=start, 1=end) a track was played. */
export type SetRole =
  | "opener"
  | "warm-up"
  | "peak-hour"
  | "cool-down"
  | "late-night";

/** Where a piece of knowledge about a song came from. */
export interface KnowledgeSource {
  /** "youtube-gig-log" = a real DJ's played setlist; "youtube-video" = general DJ content (tips/lists/blogs). */
  type: "youtube-video" | "youtube-gig-log";
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  url: string;
  publishedAt: string;
  /** Text snippet (title/description/transcript excerpt) that led to this mention. */
  evidence: string;
  ingestedAt: string;
}

/** Gig-log-only context: where this track sat in the set and what surrounded it. */
export interface GigContext {
  timeSeconds: number;
  /** 0 (set start) to 1 (set end). */
  relativePosition: number;
  setRole: SetRole;
  precededByKey: string | null;
  followedByKey: string | null;
}

/** A single mention of a song extracted from one source. */
export interface SongMention {
  title: string;
  artist: string | null;
  scenarioTags: ScenarioTag[];
  /** 0-1 confidence that this mention was correctly extracted and relevant. */
  confidence: number;
  source: KnowledgeSource;
  /** Present only when this mention came from a real played-setlist gig log. */
  gigContext?: GigContext;
}

/** Aggregated knowledge about one song across all sources. */
export interface SongKnowledge {
  /** Normalized key, e.g. "usher - yeah!" */
  key: string;
  title: string;
  artist: string | null;
  mentions: SongMention[];
  scenarioTagCounts: Partial<Record<ScenarioTag, number>>;
  /** Song key -> number of times it was played immediately after this song in a gig log. */
  followUpCounts: Record<string, number>;
  /** Song key -> number of times it was played immediately before this song in a gig log. */
  precededByCounts: Record<string, number>;
  /** Distinct DJ/channel names whose gig logs included this song (crowd-recognition signal). */
  channelsPlayedBy: string[];
  bangerScore: number;
  updatedAt: string;
}

export interface KnowledgeBase {
  version: 1;
  songs: Record<string, SongKnowledge>;
}

export function emptyKnowledgeBase(): KnowledgeBase {
  return { version: 1, songs: {} };
}

/** Normalizes "Artist - Title" style keys so mentions of the same song merge together. */
export function songKey(title: string, artist: string | null): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${norm(artist ?? "")} - ${norm(title)}`;
}

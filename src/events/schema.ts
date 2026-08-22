// Data model for the customer-meeting Event Questionnaire and the resulting DJ Game Plan.

export type EventType =
  | "wedding"
  | "birthday"
  | "sweet-16-quinceanera"
  | "graduation"
  | "corporate"
  | "school-college"
  | "club-bar"
  | "private-party"
  | "anniversary"
  | "holiday-party"
  | "concert-festival"
  | "other";

export const ALL_EVENT_TYPES: EventType[] = [
  "wedding",
  "birthday",
  "sweet-16-quinceanera",
  "graduation",
  "corporate",
  "school-college",
  "club-bar",
  "private-party",
  "anniversary",
  "holiday-party",
  "concert-festival",
  "other",
];

export type AudienceGroup =
  | "family"
  | "friends"
  | "coworkers"
  | "children"
  | "teens"
  | "young-adults"
  | "adults"
  | "older-adults";

/** All fields optional — the DJ/customer may fill in as much or as little as they know. */
export interface EventSchedule {
  guestArrival?: string;
  cocktailHour?: string;
  dinner?: string;
  dancingStarts?: string;
  specialPerformances?: string;
  cake?: string;
  toastsSpeeches?: string;
  lastSong?: string;
  eventEnd?: string;
}

export interface AudienceInfo {
  ageRanges?: string[];
  groups?: AudienceGroup[];
  /** Freeform, optional — used only to inform genre/tradition suggestions, never to stereotype. */
  culturalBackground?: string;
}

/** A song/artist request parsed from a customer's pasted free-text list. */
export interface SongRequest {
  title: string;
  artist: string | null;
  /** The original text the customer typed, kept for the DJ to double-check the parse. */
  raw: string;
}

/** Raw answers as submitted by the DJ/customer (e.g. from a form or text message). */
export interface EventInput {
  eventName: string;
  eventDate: string;
  eventType: EventType;
  /** Required when eventType === "other". */
  otherEventTypeLabel?: string;
  schedule?: EventSchedule;
  audience?: AudienceInfo;
  /** Free-text, comma/newline separated list of must-play songs/artists, pasted as-is. */
  mustPlayRaw?: string;
  /** Free-text, comma/newline separated list of do-not-play songs/artists, pasted as-is. */
  doNotPlayRaw?: string;
}

/** Normalized, parsed event profile built from an EventInput. */
export interface EventProfile {
  id: string;
  eventName: string;
  eventDate: string;
  eventType: EventType;
  /** Human-readable label — the custom label when eventType is "other", otherwise the type itself. */
  eventTypeLabel: string;
  schedule: EventSchedule;
  audience: AudienceInfo;
  mustPlay: SongRequest[];
  doNotPlay: SongRequest[];
  createdAt: string;
}

export type GamePlanSection =
  | "cocktail-arrival"
  | "dinner"
  | "dance-floor-opening"
  | "peak-hour"
  | "late-night";

export interface GamePlanTrack {
  title: string;
  artist: string | null;
  /** Why this track is in this slot. */
  reason: string;
  source: "must-play" | "knowledge-base";
  bangerScore?: number;
  /** Estimated energy on a 1-10 scale, derived from observed set roles and scenario tags. */
  energy?: number;
  /** Explains why this track follows the previous track in the generated sequence. */
  transitionReason?: string;
}

export interface GamePlanSectionPlan {
  section: GamePlanSection;
  description: string;
  tracks: GamePlanTrack[];
  targetEnergy: number;
}

export interface EventGuidance {
  title: string;
  message: string;
  priority: "important" | "helpful" | "ready";
}

export interface DjGamePlan {
  eventId: string;
  sections: GamePlanSectionPlan[];
  /** Songs the customer asked to avoid, echoed back so the DJ can double-check the parse. */
  doNotPlay: SongRequest[];
  notes: string[];
  guidance: EventGuidance[];
  generatedAt: string;
}

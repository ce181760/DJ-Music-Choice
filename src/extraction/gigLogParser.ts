import { GigContext, SetRole, songKey } from "../knowledge/schema.js";
import { isValidSong, normalizeSongFields } from "./songValidation.js";

export interface GigLogTrack {
  timeSeconds: number;
  title: string;
  artist: string | null;
}

// "0:00", "00:00", "1:02:33", optionally wrapped in parens, followed by a dash/colon and the track text.
const TIMESTAMP_LINE = /^\s*\(?(\d{1,2}(?::\d{2}){1,2})\)?\s*[-–—:]?\s*(.+?)\s*$/;
const BY_PATTERN = /^"?([^"]+?)"?\s+by\s+([^"(\n]+?)$/i;
const ARTIST_DASH_TITLE = /^([^-–—]{2,60})\s*[-–—]\s*([^-–—()]{2,80})$/;
const TITLE_PARENS_ARTIST = /^(.{2,80}?)\s*\(([^()]{2,60})\)$/;

function cleanFragment(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
}

function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function parseTrackText(text: string): { title: string; artist: string | null } {
  let match = text.match(BY_PATTERN);
  if (match) return { title: cleanFragment(match[1]), artist: cleanFragment(match[2]) };

  match = text.match(ARTIST_DASH_TITLE);
  if (match) return { artist: cleanFragment(match[1]), title: cleanFragment(match[2]) };

  match = text.match(TITLE_PARENS_ARTIST);
  if (match) return { title: cleanFragment(match[1]), artist: cleanFragment(match[2]) };

  return { title: cleanFragment(text), artist: null };
}

const NON_SONG_MARKERS = /\b(?:intro|opening|opener|headlining|closing|debrief|setup|prep|teardown|dance floor|dancefloor|mic work|crowd hype|load in|sound check|wordplay edits|blending|taking it to the club|last song of the night|wedding party intros|how to get the guys hyped|no skips|no filler|bringing you|follow me|subscribe|real mix feel|new music)\b/i;

function isLikelyNonSong(text: string): boolean {
  return (
    /^https?:\/\//i.test(text) ||
    /\b(?:mixer|controller|website|instagram|facebook|amazon)\b/i.test(text) ||
    NON_SONG_MARKERS.test(text)
  );
}

/**
 * Parses a "DJ Gig Log" style tracklist (usually in the video description) where each line
 * is a timestamp followed by the track that was played at that point in the real set, e.g.:
 *   0:00 Usher - Yeah!
 *   3:45 Flo Rida - Low
 * Returns tracks in chronological (played) order. Returns [] if fewer than 3 timestamped
 * lines are found, since that's not enough to be considered a real setlist.
 */
export function parseGigLog(text: string): GigLogTrack[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tracks: GigLogTrack[] = [];

  for (const line of lines) {
    const match = line.match(TIMESTAMP_LINE);
    if (!match) continue;
    const [, timestamp, rest] = match;
    if (!rest || rest.length < 2) continue;
    if (isLikelyNonSong(rest)) continue;
    const parsed = normalizeSongFields(parseTrackText(rest));
    if (!isValidSong(parsed)) continue;
    tracks.push({ timeSeconds: timestampToSeconds(timestamp), ...parsed });
  }

  if (tracks.length < 3) return [];
  return tracks.sort((a, b) => a.timeSeconds - b.timeSeconds);
}

function roleForPosition(relativePosition: number): SetRole {
  if (relativePosition < 0.15) return "opener";
  if (relativePosition < 0.35) return "warm-up";
  if (relativePosition < 0.75) return "peak-hour";
  if (relativePosition < 0.88) return "cool-down";
  return "late-night";
}

/** Turns a parsed gig log into per-track GigContext (set role + neighbor keys) for knowledge merging. */
export function buildGigContexts(tracks: GigLogTrack[]): GigContext[] {
  const totalDuration = Math.max(tracks[tracks.length - 1]?.timeSeconds ?? 1, 1);
  const keys = tracks.map((t) => songKey(t.title, t.artist));

  return tracks.map((track, i) => {
    const relativePosition = totalDuration === 0 ? 0 : track.timeSeconds / totalDuration;
    return {
      timeSeconds: track.timeSeconds,
      relativePosition,
      setRole: roleForPosition(relativePosition),
      precededByKey: i > 0 ? keys[i - 1] : null,
      followedByKey: i < keys.length - 1 ? keys[i + 1] : null,
    };
  });
}

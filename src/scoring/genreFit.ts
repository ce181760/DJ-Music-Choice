import { EventProfile } from "../events/schema.js";
import { SongKnowledge } from "../knowledge/schema.js";

/**
 * Genre/cultural-fit is one additive scoring factor among many (banger score, energy fit,
 * transition compatibility, etc.) — it nudges selection toward a good cultural match, it
 * never excludes everything else. A Latino event can still get a crossover English hit if
 * the evidence (Banger Score) says the crowd will respond to it.
 */

/** DJ channels whose gig logs are predominantly Latin/reggaeton/salsa sets. */
const LATIN_CHANNELS = ["djbarr-nj", "dj barr", "djvilamusic", "dj vila"];

/** Well-known Latin/reggaeton/salsa/bachata artists, used as a fallback signal when a song
 * has no channel history (e.g. it came from a generic search result). */
const LATIN_ARTIST_HINTS = [
  "bad bunny",
  "marc anthony",
  "frankie ruiz",
  "romeo santos",
  "aventura",
  "prince royce",
  "daddy yankee",
  "ozuna",
  "anuel aa",
  "j balvin",
  "karol g",
  "rauw alejandro",
  "feid",
  "nio garcia",
  "el alfa",
  "wisin",
  "yandel",
  "don omar",
  "chayanne",
  "luis fonsi",
  "selena",
  "grupo firme",
  "peso pluma",
  "leoni torres",
  "el taiger",
];

/** Characters that are distinctly Spanish (unlike á/é/í/ó/ú, which also appear in
 * French/Portuguese names like "Beyoncé" and would false-positive). */
const SPANISH_TEXT = /[ñ¡¿]/;

/** Keywords in a customer's cultural-background note or event type that call for Latin-leaning music. */
const LATIN_EVENT_KEYWORDS =
  /\b(latin|latino|latina|reggaeton|salsa|bachata|merengue|cumbia|dembow|regional\s+mexican|quinceañera|quinceanera)\b/i;

export interface GenrePreference {
  latin: boolean;
}

/** Reads the event profile for signals that the audience/occasion calls for Latin-leaning music. */
export function detectGenrePreference(profile: EventProfile): GenrePreference {
  const text = `${profile.eventType} ${profile.audience.culturalBackground ?? ""}`;
  return { latin: LATIN_EVENT_KEYWORDS.test(text) };
}

/** Heuristic check for whether a known song is a Latin/reggaeton/salsa/bachata track. */
export function isLatinSong(song: SongKnowledge): boolean {
  if (song.channelsPlayedBy.some((c) => LATIN_CHANNELS.includes(c.toLowerCase()))) return true;
  const artist = (song.artist ?? "").toLowerCase();
  if (LATIN_ARTIST_HINTS.some((hint) => artist.includes(hint))) return true;
  if (SPANISH_TEXT.test(song.title) || SPANISH_TEXT.test(song.artist ?? "")) return true;
  return false;
}

/**
 * Additive bonus/penalty (roughly -10..+20) applied on top of Banger Score. Neutral (0) when
 * the event has no genre preference, so this never changes behavior for non-Latino events.
 */
export function genreFitBonus(song: SongKnowledge, preference: GenrePreference): number {
  if (!preference.latin) return 0;
  return isLatinSong(song) ? 20 : 0;
}

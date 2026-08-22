import { inferScenarioTags } from "./scenarioTags.js";
import { ScenarioTag } from "../knowledge/schema.js";
import { isValidSong, normalizeSongFields } from "./songValidation.js";

export interface ExtractedSong {
  title: string;
  artist: string | null;
  confidence: number;
  scenarioTags: ScenarioTag[];
  /** The line/snippet the song was extracted from, kept as evidence. */
  evidence: string;
}

// "1. Artist - Title" / "1) Artist – Title"
const NUMBERED_DASH = /^\s*\d+[.)]\s*(.+?)\s*[-–—]\s*(.+?)\s*$/;
// Some playlist exports prefix numbered tracks with a label, e.g. "Clean - 20. Usher - Yeah!".
const LABEL_NUMBERED_DASH = /^\s*([^-–—]{2,60})\s*[-–—]\s*\d+[.)]\s*(.+?)\s*[-–—]\s*(.+?)\s*$/;
// "Title" by Artist / Title by Artist
const BY_PATTERN = /^\s*"?([^"]+?)"?\s+by\s+([^"(\n]+?)\s*$/i;
// Generic "Artist - Title" (no leading number), only used as a lower-confidence fallback.
const GENERIC_DASH = /^\s*([^-–—]{2,60})\s*[-–—]\s*([^-–—]{2,80})\s*$/;

function cleanFragment(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
}

/** Extracts candidate song mentions from a block of free text (title, description, or transcript). */
export function extractSongsFromText(
  text: string,
  globalTags: ScenarioTag[] = []
): ExtractedSong[] {
  const results: ExtractedSong[] = [];
  const lines = text
    .split(/\r?\n|(?<=[.!?])\s{2,}/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.length > 120 || line.length < 5) continue;

    let match = line.match(NUMBERED_DASH);
    if (match) {
      results.push(
        buildCandidate(match[1], match[2], 0.8, line, globalTags)
      );
      continue;
    }

    match = line.match(LABEL_NUMBERED_DASH);
    if (match) {
      results.push(
        buildCandidate(match[2], match[3], 0.8, line, globalTags)
      );
      continue;
    }

    match = line.match(BY_PATTERN);
    if (match) {
      // "Title" by Artist -> title = group1, artist = group2
      results.push(
        buildCandidate(match[2], match[1], 0.75, line, globalTags)
      );
      continue;
    }

    match = line.match(GENERIC_DASH);
    if (match) {
      results.push(
        buildCandidate(match[1], match[2], 0.45, line, globalTags)
      );
    }
  }

  return results;
}

function buildCandidate(
  artistRaw: string,
  titleRaw: string,
  confidence: number,
  line: string,
  globalTags: ScenarioTag[]
): ExtractedSong {
  const artist = cleanFragment(artistRaw);
  const title = cleanFragment(titleRaw);
  const normalized = normalizeSongFields({ title, artist: artist || null });
  if (!isValidSong(normalized)) {
    return {
      title: "",
      artist: null,
      confidence: 0,
      scenarioTags: [],
      evidence: line,
    };
  }
  const localTags = inferScenarioTags(line);
  const scenarioTags = Array.from(new Set([...globalTags, ...localTags]));
  return {
    title: normalized.title,
    artist: normalized.artist,
    confidence,
    scenarioTags,
    evidence: line,
  };
}

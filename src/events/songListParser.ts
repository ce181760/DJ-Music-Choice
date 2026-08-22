import { SongRequest } from "./schema.js";

const BY_PATTERN = /^"?([^"]+?)"?\s+by\s+([^"(\n]+?)$/i;
const ARTIST_DASH_TITLE = /^([^-–—]{2,60})\s*[-–—]\s*([^-–—()]{2,80})$/;
const TITLE_PARENS_ARTIST = /^(.{2,80}?)\s*\(([^()]{2,60})\)$/;

function cleanFragment(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^["']|["']$/g, "").trim();
}

/**
 * Parses a customer's freeform pasted song/artist list (must-play or do-not-play) into
 * structured requests. Accepts one entry per line, or comma/semicolon separated on one line,
 * in "Artist - Title", "Title by Artist", "Title (Artist)", or plain-text form.
 */
export function parseSongList(raw: string | undefined): SongRequest[] {
  if (!raw || !raw.trim()) return [];

  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  // Only split on commas/semicolons when the customer pasted everything on one line —
  // once there are multiple lines, keep each line intact (artist names can contain commas).
  const entries = (lines.length > 1 ? lines : lines.flatMap((l) => l.split(/,|;/)))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 120);

  const requests: SongRequest[] = [];
  for (const entry of entries) {
    // Strip leading list markers like "1.", "-", "*".
    const stripped = entry.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim();
    if (!stripped) continue;

    let match = stripped.match(BY_PATTERN);
    if (match) {
      requests.push({ title: cleanFragment(match[1]), artist: cleanFragment(match[2]), raw: entry });
      continue;
    }

    match = stripped.match(ARTIST_DASH_TITLE);
    if (match) {
      requests.push({ artist: cleanFragment(match[1]), title: cleanFragment(match[2]), raw: entry });
      continue;
    }

    match = stripped.match(TITLE_PARENS_ARTIST);
    if (match) {
      requests.push({ title: cleanFragment(match[1]), artist: cleanFragment(match[2]), raw: entry });
      continue;
    }

    // No separator found — treat as a title (could also be an artist-only request).
    requests.push({ title: cleanFragment(stripped), artist: null, raw: entry });
  }

  return requests;
}

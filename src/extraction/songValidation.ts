const NON_SONG_TEXT = /\b(?:artist\s+to\s+confirm|unknown\s+artist|equipment|load\s*-?\s*in|load\s*-?\s*out|check\s*-?\s*in|check\s*-?\s*out|sound\s*check|speaker\s+delay|mixer|controller|website|instagram|facebook|reception|ceremony|first\s+dance|outro|takedown|tracklist|playlist|subscribe|follow\s+me|how\s+to\s+set|music\s+parts|dj\s+set|dance\s+floor|crowd\s+hype|challenges|reasons?\s+why|ways?\s+to|how\s+to|tips?\s+and\s+tricks|guide\s+to|things?\s+(?:you|to|every)|mistakes?|gear|rundown|venues?|cheap\s+out|wireless|subwoofer|turntables?|sennheiser|pioneer|shure|mackie|rcf|chauvet|qsc|jbl|macbook|laptop|ipad|iphone|and\s+more|seminar|sponsor\s+spot|nightlife\s+party|party\s+set|product\s+spotlight|crank\s+stand|truss|moving\s+head|light\s+mounts?|global\s+truss|both\s+lighting|battery|conference|vlog|pricing|unboxing|accessories|specs?|sound\s+demo|real\s+world|should\s+you\s+buy|pros?|cons|overview|conclusion|final\s+review|verdict|download|intro|canon|sony|promo\s+code|wedding\s+mc|camera|gimbal|codec|bitrate|film(?:ing)?\s+(?:dj|content))\b/i;
const PLACEHOLDER_ARTIST = /^(?:artist\s+to\s+confirm|unknown(?:\s+artist)?|various\s+artists?|n\/a|none|tbd)$/i;
/** Bullet/list markers that indicate a scraped list line, not a real artist name. */
const LIST_MARKER_ARTIST = /^[•●▪◦*\-–—]/;
/** Emoji/pictographs used in venue or gear rundown lines, never in song metadata. */
const EMOJI_OR_PICTOGRAPH = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
/** "(City, ST)" venue-address annotations, or a bare ", ST" fragment from a truncated one. */
const VENUE_ADDRESS = /\([A-Z][a-zA-Z .]+,\s*[A-Z]{2}\)|,\s*[A-Z]{2}\)/;
/** "Day 1:", "Day 2 -" conference/agenda schedule labels, not song titles. */
const SCHEDULE_LABEL = /^day\s*\d+\s*[:\-]/i;
/** Measurement/spec fragments from a gear list (e.g. "12ft", "3800L", "2x"). */
const GEAR_SPEC = /\b\d+(?:ft|in|mm|cm|l|w|x)\b/i;
/** A bare video-chapter timestamp (e.g. "0:00", "5:25") mistaken for an artist. */
const TIMESTAMP_ONLY = /^\d{1,2}:\d{2}(?::\d{2})?$/;
/** Website/domain fragments (e.g. "spinelli.sellfy.store") from a description link. */
const DOMAIN_FRAGMENT = /\b[a-z0-9-]+\.(?:com|store|net|co|io|shop)\b/i;

export interface SongFields {
  title: string;
  artist: string | null;
}

/** Removes common video/list annotations without changing the song identity. */
export function normalizeSongFields(fields: SongFields): SongFields {
  return {
    title: fields.title
      .replace(/\s*\((?:official\s+)?(?:music\s+)?video\)\s*$/i, "")
      .replace(/\s*\[(?:official\s+)?(?:music\s+)?video\]\s*$/i, "")
      .replace(/\s+-\s+(?:official\s+)?(?:music\s+)?video\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim(),
    artist: fields.artist?.replace(/\s+/g, " ").trim() || null,
  };
}

/** Strict gate for knowledge-base records: recommendations need a real title and artist. */
export function isValidSong(fields: SongFields): boolean {
  const song = normalizeSongFields(fields);
  if (song.title.length < 2 || song.title.length > 100) return false;
  if (!song.artist || song.artist.length < 2 || song.artist.length > 80) return false;
  if (PLACEHOLDER_ARTIST.test(song.artist)) return false;
  if (LIST_MARKER_ARTIST.test(song.artist)) return false;
  if (TIMESTAMP_ONLY.test(song.artist) || TIMESTAMP_ONLY.test(song.title)) return false;
  if (DOMAIN_FRAGMENT.test(song.title) || DOMAIN_FRAGMENT.test(song.artist)) return false;
  if (NON_SONG_TEXT.test(`${song.artist} ${song.title}`)) return false;
  if (EMOJI_OR_PICTOGRAPH.test(`${song.artist} ${song.title}`)) return false;
  if (VENUE_ADDRESS.test(`${song.artist} ${song.title}`)) return false;
  if (SCHEDULE_LABEL.test(song.title) || SCHEDULE_LABEL.test(song.artist)) return false;
  if (GEAR_SPEC.test(song.title) || GEAR_SPEC.test(song.artist)) return false;
  if (/^https?:\/\//i.test(song.title) || /^https?:\/\//i.test(song.artist)) return false;
  if (song.title.split(/\s+/).length > 14) return false;
  // Unbalanced parens usually mean a scraped line got truncated mid-sentence.
  const parenBalance = (text: string) => (text.match(/\(/g)?.length ?? 0) === (text.match(/\)/g)?.length ?? 0);
  if (!parenBalance(song.title) || !parenBalance(song.artist)) return false;
  // Titles that read like a sentence/headline (many lowercase function words) are usually
  // scraped article/video descriptions, not song titles.
  const words = song.title.toLowerCase().split(/\s+/);
  const sentenceWords = ["the", "a", "an", "at", "for", "with", "and", "of", "to", "face", "your"];
  const sentenceWordCount = words.filter((w) => sentenceWords.includes(w)).length;
  if (words.length >= 5 && sentenceWordCount >= 3) return false;
  return true;
}
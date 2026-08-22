const NON_SONG_TEXT = /\b(?:artist\s+to\s+confirm|unknown\s+artist|equipment|load\s*-?\s*in|load\s*-?\s*out|check\s*-?\s*in|check\s*-?\s*out|sound\s*check|speaker\s+delay|mixer|controller|website|instagram|facebook|reception|ceremony|first\s+dance|outro|takedown|tracklist|playlist|subscribe|follow\s+me|how\s+to\s+set|music\s+parts|dj\s+set|dance\s+floor|crowd\s+hype)\b/i;
const PLACEHOLDER_ARTIST = /^(?:artist\s+to\s+confirm|unknown(?:\s+artist)?|various\s+artists?|n\/a|none|tbd)$/i;

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
  if (NON_SONG_TEXT.test(`${song.artist} ${song.title}`)) return false;
  if (/^https?:\/\//i.test(song.title) || /^https?:\/\//i.test(song.artist)) return false;
  if (song.title.split(/\s+/).length > 14) return false;
  return true;
}
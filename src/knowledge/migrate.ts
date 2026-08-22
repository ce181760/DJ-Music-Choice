import { computeBangerScore } from "../scoring/bangerScore.js";
import { KnowledgeBase, SongKnowledge, songKey } from "./schema.js";

const NUMBERED_TITLE = /^\s*\d+[.)]\s*(.+?)\s*[-–—]\s*(.+?)\s*$/;
const NON_SONG_MARKERS = /\b(?:intro|opening|opener|headlining|closing|debrief|debreif|setup|prep|teardown|dance floor|dancefloor|mic work|crowd hype|load in|sound check|wordplay edits|blending|taking it to the club|last song of the night|wedding party intros|how to get the guys hyped|bangers|hype new song|ending strong|project x|thursday night|peakhour|soft opening|hard open|absolute insanity|wild new wordplay|pre dinner dance set|crazy energy|no skips|no filler|bringing you|follow me|subscribe|real mix feel|new music)\b/i;

function isLegacyNonSong(song: SongKnowledge): boolean {
  return (
    /^https?:\/\//i.test(song.title) ||
    /^https?:\/\//i.test(song.artist ?? "") ||
    /\b(?:mixer|controller|website|instagram|facebook|amazon|vlog|mix|mixed and selected|dj set|dance party)\b/i.test(
      `${song.title} ${song.artist ?? ""}`
    ) ||
    (!song.artist && NON_SONG_MARKERS.test(song.title))
  );
}

function addCounts(
  target: Record<string, number>,
  source: Record<string, number>
): void {
  for (const [key, count] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + count;
  }
}

function mergeSongs(target: SongKnowledge, source: SongKnowledge): void {
  target.mentions.push(...source.mentions);
  addCounts(target.scenarioTagCounts, source.scenarioTagCounts);
  addCounts(target.followUpCounts, source.followUpCounts);
  addCounts(target.precededByCounts, source.precededByCounts);
  for (const channel of source.channelsPlayedBy) {
    if (!target.channelsPlayedBy.includes(channel)) {
      target.channelsPlayedBy.push(channel);
    }
  }
  target.updatedAt = target.updatedAt > source.updatedAt ? target.updatedAt : source.updatedAt;
}

function remapCounts(
  counts: Record<string, number>,
  keyMap: Map<string, string>
): Record<string, number> {
  const remapped: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    const newKey = keyMap.get(key);
    if (newKey === "") continue;
    const targetKey = newKey ?? key;
    remapped[targetKey] = (remapped[targetKey] ?? 0) + count;
  }
  return remapped;
}

/** Repairs legacy generic-list records that were parsed as "Clean - 20. Artist - Title". */
export function repairLegacyPlaylistEntries(kb: KnowledgeBase): number {
  const keyMap = new Map<string, string>();
  const repairedSongs: Record<string, SongKnowledge> = {};

  for (const [oldKey, song] of Object.entries(kb.songs)) {
    if (isLegacyNonSong(song)) {
      keyMap.set(oldKey, "");
      continue;
    }
    const match = song.title.match(NUMBERED_TITLE);
    const artist = match?.[1]?.trim() ?? song.artist;
    const title = match?.[2]?.trim() ?? song.title;
    const newKey = match ? songKey(title, artist) : oldKey;
    keyMap.set(oldKey, newKey);

    const repaired: SongKnowledge = {
      ...song,
      key: newKey,
      title,
      artist,
      mentions: song.mentions.map((mention) => ({
        ...mention,
        title: match ? title : mention.title,
        artist: match ? artist : mention.artist,
      })),
      scenarioTagCounts: { ...song.scenarioTagCounts },
      followUpCounts: { ...song.followUpCounts },
      precededByCounts: { ...song.precededByCounts },
      channelsPlayedBy: [...song.channelsPlayedBy],
    };

    const existing = repairedSongs[newKey];
    if (existing) mergeSongs(existing, repaired);
    else repairedSongs[newKey] = repaired;
  }

  for (const [key, song] of Object.entries(repairedSongs)) {
    song.followUpCounts = remapCounts(song.followUpCounts, keyMap);
    song.precededByCounts = remapCounts(song.precededByCounts, keyMap);
    for (const mention of song.mentions) {
      if (!mention.gigContext) continue;
      mention.gigContext.precededByKey =
        keyMap.get(mention.gigContext.precededByKey ?? "") || null;
      mention.gigContext.followedByKey =
        keyMap.get(mention.gigContext.followedByKey ?? "") || null;
    }
    song.bangerScore = computeBangerScore(song).total;
  }

  kb.songs = repairedSongs;
  return [...keyMap].filter(([oldKey, newKey]) => oldKey !== newKey).length;
}

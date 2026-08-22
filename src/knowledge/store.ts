import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptyKnowledgeBase,
  KnowledgeBase,
  ScenarioTag,
  songKey,
  SongMention,
} from "./schema.js";
import { computeBangerScore } from "../scoring/bangerScore.js";
import { isValidSong, normalizeSongFields } from "../extraction/songValidation.js";

const DEFAULT_PATH = new URL("../../data/knowledge-base.json", import.meta.url);
import { Storage } from "@google-cloud/storage";
import { config } from "../config.js";

export async function loadKnowledgeBase(
  path: URL = DEFAULT_PATH
): Promise<KnowledgeBase> {
  if (config.knowledgeBaseBucket) {
    try {
      const [raw] = await new Storage()
        .bucket(config.knowledgeBaseBucket)
        .file(config.knowledgeBaseObject)
        .download();
      const knowledgeBase = JSON.parse(raw.toString("utf8")) as KnowledgeBase;
      knowledgeBase.songs = Object.fromEntries(
        Object.entries(knowledgeBase.songs).filter(([, song]) => isValidSong(song))
      );
      return knowledgeBase;
    } catch {
      return emptyKnowledgeBase();
    }
  }
  try {
    const raw = await readFile(path, "utf-8");
    const knowledgeBase = JSON.parse(raw) as KnowledgeBase;
    knowledgeBase.songs = Object.fromEntries(
      Object.entries(knowledgeBase.songs).filter(([, song]) => isValidSong(song))
    );
    return knowledgeBase;
  } catch {
    return emptyKnowledgeBase();
  }
}

export async function saveKnowledgeBase(
  kb: KnowledgeBase,
  path: URL = DEFAULT_PATH
): Promise<void> {
  if (config.knowledgeBaseBucket) {
    await new Storage()
      .bucket(config.knowledgeBaseBucket)
      .file(config.knowledgeBaseObject)
      .save(JSON.stringify(kb, null, 2), {
        contentType: "application/json; charset=utf-8",
        resumable: false,
      });
    return;
  }
  await mkdir(dirname(fileURLToPath(path)), { recursive: true });
  await writeFile(path, JSON.stringify(kb, null, 2), "utf-8");
}

/** Merges a newly extracted mention into the knowledge base and recomputes that song's Banger Score. */
export function addMention(kb: KnowledgeBase, mention: SongMention): void {
  const normalized = normalizeSongFields(mention);
  if (!isValidSong(normalized)) return;
  mention = { ...mention, ...normalized };
  const key = songKey(mention.title, mention.artist);
  const existing = kb.songs[key];
  const song = existing ?? {
    key,
    title: mention.title,
    artist: mention.artist,
    mentions: [],
    scenarioTagCounts: {},
    followUpCounts: {},
    precededByCounts: {},
    channelsPlayedBy: [],
    bangerScore: 0,
    updatedAt: new Date().toISOString(),
  };

  song.mentions.push(mention);
  for (const tag of mention.scenarioTags) {
    song.scenarioTagCounts[tag] = (song.scenarioTagCounts[tag] ?? 0) + 1;
  }
  if (!song.channelsPlayedBy.includes(mention.source.channelTitle)) {
    song.channelsPlayedBy.push(mention.source.channelTitle);
  }
  if (mention.gigContext?.followedByKey) {
    const followKey = mention.gigContext.followedByKey;
    song.followUpCounts[followKey] = (song.followUpCounts[followKey] ?? 0) + 1;
  }
  if (mention.gigContext?.precededByKey) {
    const precededKey = mention.gigContext.precededByKey;
    song.precededByCounts[precededKey] = (song.precededByCounts[precededKey] ?? 0) + 1;
  }
  song.updatedAt = new Date().toISOString();
  song.bangerScore = computeBangerScore(song).total;

  kb.songs[key] = song;
}

export function topSongsForScenario(
  kb: KnowledgeBase,
  tag: ScenarioTag,
  limit = 10
) {
  return Object.values(kb.songs)
    .filter((s) => isValidSong(s) && (s.scenarioTagCounts[tag] ?? 0) > 0)
    .sort((a, b) => b.bangerScore - a.bangerScore)
    .slice(0, limit);
}

/** Finds a song by its normalized key, or by "artist - title" / "title" text (best-effort match). */
export function findSong(kb: KnowledgeBase, titleOrKey: string, artist: string | null = null) {
  const direct = kb.songs[titleOrKey];
  if (direct) return direct;
  const key = songKey(titleOrKey, artist);
  if (kb.songs[key]) return kb.songs[key];
  const normalizeTitle = (title: string) =>
    title
      .toLowerCase()
      .replace(/^\d+[.)]\s*[^-–—]+\s*[-–—]\s*/, "")
      .replace(/[.!?,]+/g, "")
      .replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/, "")
      .trim();
  const lower = titleOrKey.toLowerCase();
  const normalizedTitle = normalizeTitle(titleOrKey);
  return Object.values(kb.songs).find(
    (s) =>
      s.title.toLowerCase() === lower ||
      s.key.includes(lower) ||
      normalizeTitle(s.title) === normalizedTitle
  );
}

/** Ranks the songs most commonly played right after `key` in real gig logs. */
export function topFollowUps(kb: KnowledgeBase, key: string, limit = 5) {
  const song = kb.songs[key];
  if (!song) return [];
  return Object.entries(song.followUpCounts)
    .map(([followKey, count]) => ({ song: kb.songs[followKey], count }))
    .filter((entry) => entry.song)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

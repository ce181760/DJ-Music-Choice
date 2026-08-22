import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadKnowledgeBase, topSongsForScenario } from "../knowledge/store.js";
import { ingestFromSearch } from "../pipeline/ingest.js";
import { ScenarioTag, ALL_SCENARIO_TAGS } from "../knowledge/schema.js";
import { computeBangerScore } from "../scoring/bangerScore.js";
import { getGigInsights } from "../scoring/insights.js";

const SCHEDULE_ALIASES: Record<string, ScenarioTag> = {
  ceremony: "ceremony",
  cocktail: "cocktail-hour",
  "cocktail-hour": "cocktail-hour",
  dinner: "dinner",
  entrance: "grand-entrance",
  "grand-entrance": "grand-entrance",
  "first-dance": "first-dance",
  cake: "cake-cutting",
  "cake-cutting": "cake-cutting",
  bouquet: "bouquet-toss",
  "bouquet-toss": "bouquet-toss",
  dance: "dance-floor",
  "dance-floor": "dance-floor",
  peak: "peak-hour",
  "peak-hour": "peak-hour",
  "last-dance": "last-dance",
};

function stars(n: number): string {
  return "⭐".repeat(n) + "☆".repeat(5 - n);
}

const NON_SONG_EXPORT_MARKERS = /\b(?:load\s*-?\s*in|load\s*-?\s*out|check\s*-?\s*in|check\s*-?\s*out|equipment|recap|setup|teardown|soundcheck|sound\s+check|website|instagram|facebook|mixer|controller|vlog|no skips|no filler)\b/i;

function isExportableSong(song: { title: string; artist: string | null; mentions: { gigContext?: unknown }[] }): boolean {
  const text = `${song.artist ?? ""} ${song.title}`;
  return (
    Boolean(song.artist) &&
    song.mentions.some((mention) => Boolean(mention.gigContext)) &&
    !/^https?:\/\//i.test(text) &&
    !NON_SONG_EXPORT_MARKERS.test(text)
  );
}

/**
 * Usage:
 *   npm run dev:recommend -- --scenario peak-hour
 *   npm run dev:recommend -- --scenario birthday-party --limit 5
 *   npm run dev:recommend -- --scenario nightclub --all --output data/playlists/nightclub.txt
 *   npm run dev:recommend -- --scenario nightclub --research --all
 *   npm run dev:recommend -- --scenario wedding --schedule ceremony,cocktail,dinner,dance,peak,last-dance --research --all
 */
async function main() {
  const args = process.argv.slice(2);
  const scenarioIdx = args.indexOf("--scenario");
  const limitIdx = args.indexOf("--limit");
  const all = args.includes("--all");
  const research = args.includes("--research");
  const scenario = scenarioIdx !== -1 ? (args[scenarioIdx + 1] as ScenarioTag) : undefined;
  const scheduleIdx = args.indexOf("--schedule");
  const schedule =
    scheduleIdx !== -1 && args[scheduleIdx + 1]
      ? args[scheduleIdx + 1]
          .split(",")
          .map((value) => SCHEDULE_ALIASES[value.trim().toLowerCase()])
          .filter((value): value is ScenarioTag => Boolean(value))
      : [];
  const queryIdx = args.indexOf("--query");
  const outputIdx = args.indexOf("--output");
  const outputPath =
    outputIdx !== -1 && args[outputIdx + 1]
      ? args[outputIdx + 1]
      : "data/playlists/{scenario}.txt";
  const limit = all ? Number.MAX_SAFE_INTEGER : limitIdx !== -1 ? Number(args[limitIdx + 1]) : 10;

  if (!scenario || !ALL_SCENARIO_TAGS.includes(scenario)) {
    console.log(
      `Usage: npm run dev:recommend -- --scenario <tag> [--schedule stages] [--limit N] [--research] [--all --output FILE]\n` +
        `Valid tags: ${ALL_SCENARIO_TAGS.join(", ")}`
    );
    return;
  }

  const researchQuery =
    queryIdx !== -1 && args[queryIdx + 1]
      ? args[queryIdx + 1]
      : `DJ gig log ${scenario}`;

  if (research) {
    const queries = schedule.length > 0
      ? schedule.map((stage) => `${scenario} DJ gig log ${stage}`)
      : [researchQuery];
    for (const query of queries) {
      console.log(`Researching gig-log videos for "${query}"...`);
      await ingestFromSearch(query);
    }
  }

  const kb = await loadKnowledgeBase();
  const songs = topSongsForScenario(kb, scenario, limit);

  if (songs.length === 0 && schedule.length === 0) {
    console.log(`No knowledge yet for "${scenario}". Run the ingest CLI first.`);
    return;
  }

  if (all) {
    const filePath = resolve(outputPath.replace("{scenario}", scenario));
    const songsForTag = (tag: ScenarioTag) =>
      topSongsForScenario(kb, tag, Number.MAX_SAFE_INTEGER).filter(
        isExportableSong
      );
    const sections = schedule.length > 0
      ? schedule.map((tag) => ({ tag, songs: songsForTag(tag) }))
      : [{ tag: scenario, songs: songs.filter(
          isExportableSong
        ) }];
    const populatedSections = sections.filter((section) => section.songs.length > 0);
    const exportSongs = populatedSections.flatMap((section) => section.songs);
    if (exportSongs.length === 0) {
      console.log(`No real songs found for "${scenario}".`);
      return;
    }
    const lines = [
      `${scenario} playlist`,
      "",
      "Songs are grouped by the part of the event.",
      "",
      ...populatedSections.flatMap(({ tag, songs: sectionSongs }) => [
        `${tag}`,
        "",
        ...sectionSongs.map((song, index) => {
          const artist = song.artist ?? "Unknown Artist";
          const search = encodeURIComponent(`${artist} ${song.title}`);
          return `${index + 1}. ${artist} - ${song.title}\n   Listen here: https://www.youtube.com/results?search_query=${search}`;
        }),
        "",
      ]),
      "",
      "The links open YouTube search results.",
    ];
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, lines.join("\n"), "utf8");
    console.log(`Exported ${exportSongs.length} songs to ${filePath}`);
    return;
  }

  console.log(`Top "${scenario}" recommendations:\n`);
  for (const song of songs) {
    const { total } = computeBangerScore(song);
    const insights = getGigInsights(song, kb);
    console.log(
      `${song.artist ?? "Unknown Artist"} — ${song.title}  (Banger Score: ${total}/100)`
    );
    console.log(`  Party effectiveness: ${stars(Math.round(total / 20))}`);
    console.log(`  Peak-hour strength: ${insights.peakHourStrength}%`);
    console.log(`  Crowd recognition: ${stars(insights.crowdRecognitionStars)}`);
    console.log(`  Best scenarios: ${insights.bestScenarios.join(", ")}`);
    if (insights.topFollowUps.length > 0) {
      const followUps = insights.topFollowUps
        .map((f) => `${f.artist ?? "Unknown"} - ${f.title} (${f.count}x)`)
        .join("; ");
      console.log(`  Common follow-ups: ${followUps}`);
    }
    console.log(`  Confidence: ${insights.confidence}\n`);
  }
}


main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

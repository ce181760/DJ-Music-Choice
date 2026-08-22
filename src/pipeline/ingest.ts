import { getVideoDetails, searchDjVideos } from "../youtube/client.js";
import { getVideoTranscript } from "../youtube/transcript.js";
import { extractSongsFromText } from "../extraction/songExtractor.js";
import { inferScenarioTags } from "../extraction/scenarioTags.js";
import { buildGigContexts, parseGigLog } from "../extraction/gigLogParser.js";
import { addMention, loadKnowledgeBase, saveKnowledgeBase } from "../knowledge/store.js";
import { KnowledgeSource, ScenarioTag, SongMention } from "../knowledge/schema.js";

const MIN_CONFIDENCE = 0.4;
// A real DJ Gig Log is a much stronger signal than a generic "list video" mention.
const GIG_LOG_CONFIDENCE = 0.9;

/** Ingests one YouTube video: pulls public metadata + transcript, extracts song mentions, merges into the knowledge base. */
export async function ingestVideo(videoId: string, contextText = ""): Promise<number> {
  const details = await getVideoDetails(videoId);
  if (!details) {
    console.warn(`No metadata found for video ${videoId}, skipping.`);
    return 0;
  }

  const transcript = await getVideoTranscript(videoId);
  const globalTags = inferScenarioTags(
    `${contextText} ${details.title} ${details.description}`
  );
  const source: KnowledgeSource = {
    type: "youtube-video",
    videoId: details.videoId,
    videoTitle: details.title,
    channelTitle: details.channelTitle,
    url: `https://www.youtube.com/watch?v=${details.videoId}`,
    publishedAt: details.publishedAt,
    evidence: "",
    ingestedAt: new Date().toISOString(),
  };

  // A gig log tracklist (timestamps in the description) is the primary, highest-value
  // source: it tells us what a real DJ actually played, in order, during a real set.
  const gigTracks = parseGigLog(details.description) || parseGigLog(transcript);
  const kb = await loadKnowledgeBase();
  let mentionCount = 0;

  if (gigTracks.length >= 3) {
    const contexts = buildGigContexts(gigTracks);
    for (let i = 0; i < gigTracks.length; i++) {
      const track = gigTracks[i];
      const context = contexts[i];
      const scenarioTags = Array.from(new Set([...globalTags, context.setRole])) as ScenarioTag[];
      addMention(kb, {
        title: track.title,
        artist: track.artist,
        scenarioTags,
        confidence: GIG_LOG_CONFIDENCE,
        source: {
          ...source,
          type: "youtube-gig-log",
          evidence: `${Math.round(context.timeSeconds)}s: ${track.artist ?? ""} - ${track.title}`,
        },
        gigContext: context,
      });
      mentionCount++;
    }
    await saveKnowledgeBase(kb);
    return mentionCount;
  }

  // Fallback: generic DJ content (lists, tips, blogs) with lower-confidence extraction.
  const candidates = [
    ...extractSongsFromText(details.title, globalTags),
    ...extractSongsFromText(details.description, globalTags),
    ...(transcript ? extractSongsFromText(transcript, globalTags) : []),
  ].filter((c) => c.confidence >= MIN_CONFIDENCE && c.title.length > 0 && c.artist);

  for (const candidate of candidates) {
    const mention: SongMention = {
      title: candidate.title,
      artist: candidate.artist,
      scenarioTags: candidate.scenarioTags,
      confidence: candidate.confidence,
      source: { ...source, evidence: candidate.evidence },
    };
    addMention(kb, mention);
  }

  await saveKnowledgeBase(kb);
  return candidates.length;
}

/** Searches YouTube for DJ-oriented videos matching a query, then ingests each result. */
export async function ingestFromSearch(query: string, maxResults = 10): Promise<void> {
  const results = await searchDjVideos(query, maxResults);
  for (const result of results) {
    console.log(`Ingesting "${result.title}" (${result.videoId})...`);
    try {
      const count = await ingestVideo(result.videoId, query);
      console.log(`  -> extracted ${count} candidate song mention(s).`);
    } catch (err) {
      console.warn(`  -> failed: ${(err as Error).message}`);
    }
  }
}

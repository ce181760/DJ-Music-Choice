import { KnowledgeBase, SongKnowledge } from "../knowledge/schema.js";
import { topFollowUps } from "../knowledge/store.js";

export interface GigInsights {
  /** % of gig-log plays that landed in the peak-hour window of the set. */
  peakHourStrength: number;
  /** 1-5 stars: how many distinct DJs/channels have independently played this song. */
  crowdRecognitionStars: number;
  bestScenarios: string[];
  topFollowUps: { title: string; artist: string | null; count: number }[];
  confidence: "high" | "medium" | "low";
}

function starsForChannelCount(count: number): number {
  if (count >= 7) return 5;
  if (count >= 4) return 4;
  if (count >= 2) return 3;
  if (count >= 1) return 2;
  return 1;
}

/** Summarizes a song's real-gig-log track record into the human-readable form used by recommendations. */
export function getGigInsights(song: SongKnowledge, kb: KnowledgeBase): GigInsights {
  const gigMentions = song.mentions.filter((m) => m.gigContext);
  const peakHourMentions = gigMentions.filter((m) => m.gigContext?.setRole === "peak-hour");
  const peakHourStrength =
    gigMentions.length === 0 ? 0 : Math.round((peakHourMentions.length / gigMentions.length) * 100);

  const distinctGigChannels = new Set(gigMentions.map((m) => m.source.channelTitle)).size;
  const crowdRecognitionStars = starsForChannelCount(distinctGigChannels);

  const bestScenarios = Object.entries(song.scenarioTagCounts)
    .sort((a, b) => b[1]! - a[1]!)
    .map(([tag]) => tag);

  const followUps = topFollowUps(kb, song.key, 3).map((f) => ({
    title: f.song.title,
    artist: f.song.artist,
    count: f.count,
  }));

  const confidence: GigInsights["confidence"] =
    distinctGigChannels >= 3 ? "high" : distinctGigChannels >= 1 ? "medium" : "low";

  return { peakHourStrength, crowdRecognitionStars, bestScenarios, topFollowUps: followUps, confidence };
}

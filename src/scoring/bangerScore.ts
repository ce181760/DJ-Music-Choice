import { ScenarioTag, SongKnowledge } from "../knowledge/schema.js";

/**
 * Weighted signals used to compute a song's Banger Score (0-100).
 * Weights mirror the design: DJ recommendations 30%, frequency 20%,
 * event-scenario suitability 15%, crowd/party reputation 15%, energy 10%,
 * transition compatibility 10%.
 */
const WEIGHTS = {
  djRecommendations: 0.3,
  frequencyMentioned: 0.2,
  scenarioSuitability: 0.15,
  crowdReputation: 0.15,
  energy: 0.1,
  transitionCompatibility: 0.1,
} as const;

const HIGH_ENERGY_TAGS: ScenarioTag[] = [
  "banger",
  "peak-hour",
  "dance-floor",
  "college-party",
  "prom",
  "nightclub",
  "house-party",
  "pool-party",
  "beach-party",
  "block-party",
  "graduation",
  "quinceanera",
  "sweet-16",
  "concert-festival",
  "sports-party",
  "bachelor-party",
  "bachelorette-party",
];
const LOW_ENERGY_TAGS: ScenarioTag[] = [
  "cocktail-dinner",
  "slow-singalong",
  "late-night",
  "opener",
  "warm-up",
  "cool-down",
];
const REPUTATION_TAGS: ScenarioTag[] = [
  "banger",
  "dance-floor",
  "peak-hour",
  "birthday-party",
  "college-party",
  "prom",
  "nightclub",
  "house-party",
  "pool-party",
  "beach-party",
  "block-party",
  "graduation",
  "quinceanera",
  "sweet-16",
  "corporate-event",
  "holiday-party",
  "concert-festival",
  "sports-party",
  "family-party",
  "bachelor-party",
  "bachelorette-party",
  "fundraiser",
  "wedding",
  "car-show-party",
];
const TRANSITION_TAGS: ScenarioTag[] = ["transition", "dj-tool"];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export interface BangerScoreBreakdown {
  total: number;
  signals: Record<keyof typeof WEIGHTS, number>;
}

/** Computes a 0-100 Banger Score plus the per-signal breakdown (also 0-100 each) so the "why" can be explained. */
export function computeBangerScore(song: SongKnowledge): BangerScoreBreakdown {
  const mentions = song.mentions;
  const distinctSources = new Set(mentions.map((m) => m.source.videoId)).size;
  const avgConfidence =
    mentions.length === 0
      ? 0
      : mentions.reduce((sum, m) => sum + m.confidence, 0) / mentions.length;

  const tagCounts = song.scenarioTagCounts;
  const tagsPresent = Object.keys(tagCounts) as ScenarioTag[];

  const djRecommendations = clamp01(avgConfidence) * 100;
  const frequencyMentioned = clamp01(distinctSources / 10) * 100;
  const scenarioSuitability = clamp01(tagsPresent.length / 6) * 100;

  const reputationHits = REPUTATION_TAGS.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0);
  const crowdReputation = clamp01(reputationHits / 5) * 100;

  const highEnergyHits = HIGH_ENERGY_TAGS.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0);
  const lowEnergyHits = LOW_ENERGY_TAGS.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0);
  const energy =
    highEnergyHits + lowEnergyHits === 0
      ? 50
      : clamp01(highEnergyHits / (highEnergyHits + lowEnergyHits)) * 100;

  const transitionHits = TRANSITION_TAGS.reduce((sum, tag) => sum + (tagCounts[tag] ?? 0), 0);
  const transitionCompatibility = clamp01(transitionHits / 3) * 100;

  const signals = {
    djRecommendations,
    frequencyMentioned,
    scenarioSuitability,
    crowdReputation,
    energy,
    transitionCompatibility,
  };

  const total = Math.round(
    Object.entries(WEIGHTS).reduce(
      (sum, [key, weight]) => sum + signals[key as keyof typeof WEIGHTS] * weight,
      0
    )
  );

  return { total, signals };
}

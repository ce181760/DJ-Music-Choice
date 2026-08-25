import { KnowledgeBase, ScenarioTag, SongKnowledge, songKey } from "../knowledge/schema.js";
import { findSong } from "../knowledge/store.js";
import { computeBangerScore } from "../scoring/bangerScore.js";
import {
  DjGamePlan,
  EventProfile,
  GamePlanSection,
  GamePlanSectionPlan,
  GamePlanTrack,
  SongRequest,
} from "./schema.js";
import { buildEventGuidance } from "./guidance.js";
import { isValidSong } from "../extraction/songValidation.js";
import { buildEnergyCurve, pointForSection } from "./energyCurve.js";
import { detectGenrePreference, genreFitBonus, GenrePreference } from "../scoring/genreFit.js";

const SECTION_TAGS: Record<GamePlanSection, ScenarioTag[]> = {
  "cocktail-arrival": ["cocktail-hour", "cocktail-dinner"],
  dinner: ["dinner", "cocktail-dinner", "cocktail-hour"],
  "dance-floor-opening": ["opener", "warm-up", "dance-floor"],
  "peak-hour": ["peak-hour", "banger"],
  "late-night": ["late-night", "slow-singalong"],
};

const SECTION_DESCRIPTIONS: Record<GamePlanSection, string> = {
  "cocktail-arrival": "Moderate energy, welcoming background music as guests arrive.",
  dinner: "Background / conversational — low enough to talk over.",
  "dance-floor-opening": "Familiar, crowd-friendly songs to get the first dancers up.",
  "peak-hour": "High-confidence bangers — the main event.",
  "late-night": "Higher-energy or sing-along/requested styles to close out the night.",
};

const SECTION_ORDER: GamePlanSection[] = [
  "cocktail-arrival",
  "dinner",
  "dance-floor-opening",
  "peak-hour",
  "late-night",
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True if a song matches something on the customer's do-not-play list (by title or by artist alone). */
function isExcluded(title: string, artist: string | null, doNotPlay: SongRequest[]): boolean {
  const normTitle = normalize(title);
  const normArtist = artist ? normalize(artist) : null;
  return doNotPlay.some((entry) => {
    const entryTitle = normalize(entry.title);
    const entryArtist = entry.artist ? normalize(entry.artist) : null;
    if (entryArtist && normArtist === entryArtist) return true;
    if (entryTitle === normTitle) return true;
    // Entry had no separator (e.g. just "Nickelback") — could be an artist-only exclusion.
    if (!entryArtist && normArtist === entryTitle) return true;
    return false;
  });
}

/** Picks the game-plan section a known song is the best fit for, based on its scenario tag history. */
function pickSectionForSong(song: SongKnowledge): GamePlanSection {
  let best: GamePlanSection = "peak-hour";
  let bestCount = -1;
  for (const section of SECTION_ORDER) {
    const count = SECTION_TAGS[section].reduce(
      (sum, tag) => sum + (song.scenarioTagCounts[tag] ?? 0),
      0
    );
    if (count > bestCount) {
      bestCount = count;
      best = section;
    }
  }
  return best;
}

function songEnergy(song: SongKnowledge): number {
  const high = ["banger", "peak-hour", "dance-floor", "nightclub", "party"];
  const low = ["cocktail-dinner", "slow-singalong", "opener", "warm-up", "cool-down"];
  const tags = Object.entries(song.scenarioTagCounts);
  const highHits = tags.reduce((sum, [tag, count]) => sum + (high.includes(tag) ? count : 0), 0);
  const lowHits = tags.reduce((sum, [tag, count]) => sum + (low.includes(tag) ? count : 0), 0);
  if (highHits + lowHits === 0) return 5;
  return Math.max(1, Math.min(10, Math.round(1 + (highHits / (highHits + lowHits)) * 9)));
}

function formatSectionLabel(section: GamePlanSection): string {
  return section
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Human-readable breakdown of every factor behind a knowledge-base recommendation. */
function buildEvidence(
  song: SongKnowledge,
  section: GamePlanSection,
  genrePreference: GenrePreference,
  targetEnergy: number
): string[] {
  const evidence: string[] = [];

  const tags = SECTION_TAGS[section];
  const tagHitCount = tags.reduce((sum, tag) => sum + (song.scenarioTagCounts[tag] ?? 0), 0);
  if (tagHitCount > 0) {
    evidence.push(`🎯 ${formatSectionLabel(section)} fit — seen in ${tagHitCount} matching set${tagHitCount === 1 ? "" : "s"}.`);
  }

  const bonus = genreFitBonus(song, genrePreference);
  if (bonus > 0) {
    evidence.push(`🌎 Latin/cultural fit +${bonus}.`);
  }

  const energy = songEnergy(song);
  evidence.push(`📈 Energy ${energy}/10, targeting ${targetEnergy}/10 for this moment.`);

  const breakdown = computeBangerScore(song);
  if (breakdown.signals.transitionCompatibility >= 50) {
    evidence.push("🔄 Strong transition potential — mixed cleanly in past sets.");
  }

  const distinctSources = new Set(song.mentions.map((m) => m.source.videoId)).size;
  if (distinctSources > 0) {
    evidence.push(`🎧 Appeared in ${distinctSources} relevant DJ set${distinctSources === 1 ? "" : "s"}.`);
  }

  evidence.push(`🔥 Banger Score ${song.bangerScore}/100.`);
  return evidence;
}

function sequenceTracks(
  tracks: GamePlanTrack[],
  kb: KnowledgeBase,
  targetEnergy: number,
  resetReason?: string
): GamePlanTrack[] {
  const remaining = [...tracks];
  const ordered: GamePlanTrack[] = [];
  let previous: SongKnowledge | undefined;

  while (remaining.length > 0) {
    const artistAvailable = previous?.artist
      ? remaining.some((track) => track.artist && normalize(track.artist) !== normalize(previous!.artist!))
      : true;
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index++) {
      const track = remaining[index];
      const known = findSong(kb, track.title, track.artist);
      const energy = known ? songEnergy(known) : 5;
      const sameArtist = Boolean(previous?.artist && track.artist && normalize(previous.artist) === normalize(track.artist));
      if (artistAvailable && sameArtist) continue;
      const followUpCount = previous && known ? previous.followUpCounts[known.key] ?? 0 : 0;
      const transitionScore = followUpCount * 25 + (10 - Math.abs(targetEnergy - energy)) * 4;
      const score = transitionScore + (track.bangerScore ?? 0) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [selected] = remaining.splice(bestIndex, 1);
    const selectedSong = findSong(kb, selected.title, selected.artist);
    const selectedEnergy = selectedSong ? songEnergy(selectedSong) : 5;
    const followed = previous && selectedSong ? previous.followUpCounts[selectedSong.key] ?? 0 : 0;
    const artistChange = previous?.artist && selected.artist && normalize(previous.artist) !== normalize(selected.artist);
    const transitionReason = !previous && resetReason
      ? `Energy reset: ${resetReason}`
      : !previous
      ? `Opens this section near the ${targetEnergy}/10 energy target.`
      : followed > 0
        ? `Played after ${previous.title} in ${followed} recorded DJ set${followed === 1 ? "" : "s"}.`
        : artistChange
          ? `Changes artist while staying near the ${targetEnergy}/10 energy target.`
          : `Keeps the section near its ${targetEnergy}/10 energy target.`;
    const transitionEvidence = !previous ? [] : [`🔄 ${transitionReason}`];
    ordered.push({
      ...selected,
      energy: selectedEnergy,
      transitionReason,
      evidence: [...(selected.evidence ?? []), ...transitionEvidence],
    });
    previous = selectedSong;
  }
  return ordered;
}

/**
 * Builds a DJ Game Plan from an event profile + the DJ Gig Log knowledge base.
 * Must-play songs become anchors placed in their best-fit section; the rest of each
 * section is filled with high-Banger-Score knowledge-base picks, excluding do-not-play.
 */
export function buildGamePlan(profile: EventProfile, kb: KnowledgeBase): DjGamePlan {
  const energyCurve = buildEnergyCurve(profile);
  const genrePreference = detectGenrePreference(profile);
  const usedKeys = new Set<string>();
  const sections: Record<GamePlanSection, GamePlanTrack[]> = {
    "cocktail-arrival": [],
    dinner: [],
    "dance-floor-opening": [],
    "peak-hour": [],
    "late-night": [],
  };

  for (const request of profile.mustPlay) {
    if (isExcluded(request.title, request.artist, profile.doNotPlay)) continue;
    const known = findSong(kb, request.title, request.artist);
    const section = known ? pickSectionForSong(known) : "peak-hour";
    const key = known?.key ?? songKey(request.title, request.artist);
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    sections[section].push({
      title: request.title,
      artist: request.artist,
      source: "must-play",
      bangerScore: known ? computeBangerScore(known).total : undefined,
      reason: known
        ? "Customer requested — anchor track, backed by DJ gig log history."
        : "Customer requested — anchor track (no gig log history yet, verify fit).",
      evidence: known
        ? ["⭐ Customer requested — anchor track.", ...buildEvidence(known, section, genrePreference, pointForSection(energyCurve, section).targetEnergy)]
        : ["⭐ Customer requested — no gig log history yet, verify fit."],
    });
  }

  const FILL_TARGET = 8;
  for (const section of SECTION_ORDER) {
    const tags = SECTION_TAGS[section];
    const targetEnergy = pointForSection(energyCurve, section).targetEnergy;
    const candidates = Object.values(kb.songs)
      .filter((s) => isValidSong(s))
      .filter((s) => tags.some((tag) => (s.scenarioTagCounts[tag] ?? 0) > 0))
      .filter((s) => !usedKeys.has(s.key))
      .filter((s) => !isExcluded(s.title, s.artist, profile.doNotPlay))
      .sort((a, b) =>
        (b.bangerScore + genreFitBonus(b, genrePreference)) -
        (a.bangerScore + genreFitBonus(a, genrePreference))
      );

    for (const candidate of candidates) {
      if (sections[section].length >= FILL_TARGET) break;
      usedKeys.add(candidate.key);
      const culturalFit = genreFitBonus(candidate, genrePreference) > 0;
      sections[section].push({
        title: candidate.title,
        artist: candidate.artist,
        source: "knowledge-base",
        bangerScore: candidate.bangerScore,
        reason: culturalFit
          ? `High Banger Score (${candidate.bangerScore}/100) and a strong cultural fit for this crowd.`
          : `High Banger Score (${candidate.bangerScore}/100) for this slot from DJ gig log knowledge.`,
        evidence: buildEvidence(candidate, section, genrePreference, targetEnergy),
      });
    }

    // Sparse scenario-tag data (e.g. dinner) shouldn't leave a section empty — fall back to
    // any valid, unused song whose energy fits the target for this moment of the night.
    if (sections[section].length < FILL_TARGET) {
      const fallback = Object.values(kb.songs)
        .filter((s) => isValidSong(s))
        .filter((s) => !usedKeys.has(s.key))
        .filter((s) => !isExcluded(s.title, s.artist, profile.doNotPlay))
        .sort((a, b) => {
          const energyDiffA = Math.abs(songEnergy(a) - targetEnergy);
          const energyDiffB = Math.abs(songEnergy(b) - targetEnergy);
          if (energyDiffA !== energyDiffB) return energyDiffA - energyDiffB;
          return (b.bangerScore + genreFitBonus(b, genrePreference)) - (a.bangerScore + genreFitBonus(a, genrePreference));
        });

      for (const candidate of fallback) {
        if (sections[section].length >= FILL_TARGET) break;
        usedKeys.add(candidate.key);
        const culturalFit = genreFitBonus(candidate, genrePreference) > 0;
        sections[section].push({
          title: candidate.title,
          artist: candidate.artist,
          source: "knowledge-base",
          bangerScore: candidate.bangerScore,
          reason: culturalFit
            ? `Closest energy match (${songEnergy(candidate)}/10) and a strong cultural fit for this slot.`
            : `Closest energy match (${songEnergy(candidate)}/10) for this slot from DJ gig log knowledge.`,
          evidence: buildEvidence(candidate, section, genrePreference, targetEnergy),
        });
      }
    }
  }


  const sectionPlans: GamePlanSectionPlan[] = SECTION_ORDER.map((section, index) => {
    const point = pointForSection(energyCurve, section);
    const targetEnergy = point.targetEnergy;
    const previousTarget = index > 0 ? pointForSection(energyCurve, SECTION_ORDER[index - 1]).targetEnergy : targetEnergy;
    const energyReset = targetEnergy < previousTarget && point.reset
      ? {
          fromEnergy: previousTarget,
          toEnergy: targetEnergy,
          style: point.resetStyle ?? "small",
          reason: point.resetReason ?? point.purpose,
        }
      : undefined;
    return {
    section,
    description: SECTION_DESCRIPTIONS[section],
    targetEnergy,
    energyReset,
    tracks: sequenceTracks(sections[section], kb, targetEnergy, energyReset?.reason),
    };
  });

  return {
    eventId: profile.id,
    energyCurve,
    sections: sectionPlans,
    doNotPlay: profile.doNotPlay,
    notes: [
      "Don't treat the Must Play list as the entire playlist — those are anchors the rest of the night is built around.",
      "Do Not Play entries were filtered out of every recommended slot above; double-check the parsed list against the customer's original message.",
    ],
    guidance: buildEventGuidance(profile),
    generatedAt: new Date().toISOString(),
  };
}

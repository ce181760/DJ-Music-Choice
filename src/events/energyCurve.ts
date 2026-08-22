import { EnergyCurve, EnergyIntensity, EventProfile, GamePlanSection } from "./schema.js";

type CurveTemplate = { labels: string[]; targets: number[]; purposes: string[]; resetIndex: number };

const TEMPLATES: Record<string, CurveTemplate> = {
  wedding: {
    labels: ["Cocktail", "Dinner", "First dances", "Dance-floor build", "Peak", "Celebration", "Finale"],
    targets: [3, 4, 4, 6, 9, 8, 7],
    purposes: ["Welcome guests", "Keep conversation easy", "Protect special moments", "Invite the first dancers", "Main dance-floor peak", "Celebrate together", "End on a familiar high"],
    resetIndex: -1,
  },
  "club-bar": {
    labels: ["Warm-up", "Build", "Peak", "Reset", "Peak return", "Finale"],
    targets: [5, 7, 9, 6, 9, 8],
    purposes: ["Establish the room", "Raise the floor", "Sustain intensity", "Create contrast", "Make the return feel bigger", "Close with momentum"],
    resetIndex: 3,
  },
  "school-college": {
    labels: ["Arrival", "Fast build", "Peak", "Reset", "Peak return", "Finale"],
    targets: [5, 7, 9, 6, 9, 8],
    purposes: ["Get guests comfortable", "Reach the floor quickly", "Hold the main peak", "Give the room a breath", "Rebuild with confidence", "Finish recognizable"],
    resetIndex: 3,
  },
  corporate: {
    labels: ["Arrival", "Social", "Build", "Controlled peak", "Finale"],
    targets: [3, 4, 6, 7, 6],
    purposes: ["Welcome guests", "Leave room for conversation", "Open the dance floor", "Keep energy inclusive", "Close without overplaying"],
    resetIndex: -1,
  },
  birthday: {
    labels: ["Arrival", "Warm-up", "Social reset", "Build", "Peak", "Celebration", "Finale"],
    targets: [4, 5, 4, 7, 9, 8, 7],
    purposes: ["Welcome guests", "Build familiarity", "Make space for conversation", "Bring guests to the floor", "Deliver the major peak", "Celebrate the guest of honor", "End with a sing-along"],
    resetIndex: 2,
  },
};

const DEFAULT_TEMPLATE: CurveTemplate = {
  labels: ["Arrival", "Warm-up", "Social reset", "Build", "Peak", "Finale"],
  targets: [3, 5, 4, 7, 9, 7],
  purposes: ["Welcome guests", "Establish the room", "Create breathing room", "Raise energy", "Main event", "Close intentionally"],
  resetIndex: 2,
};

function minutesFromTime(value: string | undefined): number | null {
  const match = value?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function durationFor(profile: EventProfile): number {
  const start = minutesFromTime(profile.schedule.guestArrival ?? profile.schedule.cocktailHour);
  const end = minutesFromTime(profile.schedule.eventEnd ?? profile.schedule.lastSong);
  if (start === null || end === null) return 240;
  const duration = end >= start ? end - start : end + 24 * 60 - start;
  return Math.max(30, duration);
}

function adjustedTarget(target: number, intensity: EnergyIntensity | undefined): number {
  const delta = intensity === "high" ? 1 : intensity === "low" ? -1 : 0;
  return Math.max(1, Math.min(10, target + delta));
}

/** Builds the event-level energy trajectory consumed by the section sequencer. */
export function buildEnergyCurve(profile: EventProfile): EnergyCurve {
  const template = TEMPLATES[profile.eventType] ?? DEFAULT_TEMPLATE;
  const preferences = profile.energyPreferences;
  const targets = template.targets.map((target) => adjustedTarget(target, preferences.intensity));
  if (preferences.build === "slow") {
    for (let i = 0; i < Math.ceil(targets.length / 2); i++) targets[i] = Math.min(targets[i], 5);
  } else if (preferences.build === "explosive") {
    targets[1] = Math.min(8, Math.max(targets[1], 7));
  }

  const totalMinutes = durationFor(profile);
  const peakMinutes = Math.max(15, Math.min(totalMinutes, preferences.peakMinutes ?? Math.round(totalMinutes * 0.25)));
  const peakIndex = template.labels.findIndex((label) => label.toLowerCase() === "peak");
  const nonPeakMinutes = Math.max(0, totalMinutes - peakMinutes);
  const nonPeakWeight = template.labels.length - (peakIndex >= 0 ? 1 : 0);
  const regularMinutes = nonPeakWeight > 0 ? nonPeakMinutes / nonPeakWeight : totalMinutes;
  const weights = template.labels.map((_, index) => (index === peakIndex ? peakMinutes : regularMinutes));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  const points = template.labels.map((label, index) => {
    const startMinute = Math.round(cursor);
    cursor += (weights[index] / weightTotal) * totalMinutes;
    return {
      label,
      startMinute,
      endMinute: Math.round(cursor),
      targetEnergy: targets[index],
      purpose: template.purposes[index],
      reset: index === template.resetIndex,
    };
  });
  return { totalMinutes, points };
}

export function targetEnergyAt(curve: EnergyCurve, minute: number): number {
  const point = curve.points.find((candidate) => minute >= candidate.startMinute && minute < candidate.endMinute)
    ?? curve.points[curve.points.length - 1];
  return point.targetEnergy;
}

export function targetEnergyForSection(curve: EnergyCurve, section: GamePlanSection): number {
  const labels: Record<GamePlanSection, string[]> = {
    "cocktail-arrival": ["cocktail", "arrival"],
    dinner: ["dinner", "social"],
    "dance-floor-opening": ["build", "fast build", "warm-up"],
    "peak-hour": ["peak"],
    "late-night": ["finale", "celebration", "late"],
  };
  for (const label of labels[section]) {
    const point = curve.points.find((candidate) => candidate.label.toLowerCase().includes(label));
    if (point) return point.targetEnergy;
  }
  const fallbackMinute = ((Object.keys(labels).indexOf(section) + 0.5) / 5) * curve.totalMinutes;
  return targetEnergyAt(curve, fallbackMinute);
}
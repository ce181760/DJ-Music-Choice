import {
  ALL_EVENT_TYPES,
  EventInput,
  EventProfile,
} from "./schema.js";
import { parseSongList } from "./songListParser.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Validates and normalizes raw questionnaire answers into an EventProfile. */
export function buildEventProfile(input: EventInput): EventProfile {
  if (!input.eventName?.trim()) throw new Error("eventName is required");
  if (!input.eventDate?.trim()) throw new Error("eventDate is required");
  if (!ALL_EVENT_TYPES.includes(input.eventType)) {
    throw new Error(`eventType must be one of: ${ALL_EVENT_TYPES.join(", ")}`);
  }
  if (input.eventType === "other" && !input.otherEventTypeLabel?.trim()) {
    throw new Error('otherEventTypeLabel is required when eventType is "other"');
  }

  const eventTypeLabel =
    input.eventType === "other" ? input.otherEventTypeLabel!.trim() : input.eventType;

  return {
    id: `${slugify(input.eventName)}-${slugify(input.eventDate)}`,
    eventName: input.eventName.trim(),
    eventDate: input.eventDate.trim(),
    eventType: input.eventType,
    eventTypeLabel,
    schedule: input.schedule ?? {},
    audience: input.audience ?? {},
    energyPreferences: input.energyPreferences ?? {},
    mustPlay: parseSongList(input.mustPlayRaw),
    doNotPlay: parseSongList(input.doNotPlayRaw),
    createdAt: new Date().toISOString(),
  };
}

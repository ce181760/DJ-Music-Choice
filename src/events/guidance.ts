import { EventProfile, EventType } from "./schema.js";

export interface EventGuidance {
  title: string;
  message: string;
  priority: "important" | "helpful" | "ready";
}

function hasAnySchedule(profile: EventProfile): boolean {
  return Object.values(profile.schedule).some(Boolean);
}

function addTimelineGuidance(profile: EventProfile, guidance: EventGuidance[]): void {
  if (!hasAnySchedule(profile)) {
    guidance.push({
      title: "Make a simple timeline",
      message: "Choose a guest arrival time, dinner time, dancing start, and event end time.",
      priority: "important",
    });
    return;
  }

  const schedule = profile.schedule;
  if (!schedule.guestArrival) {
    guidance.push({
      title: "Add guest arrival time",
      message: "This tells the DJ when welcoming background music should begin.",
      priority: "helpful",
    });
  }
  if (!schedule.dancingStarts) {
    guidance.push({
      title: "Choose when dancing starts",
      message: "This gives the DJ a clear moment to move from dinner music to dance music.",
      priority: "important",
    });
  }
  if (!schedule.lastSong && !schedule.eventEnd) {
    guidance.push({
      title: "Choose an ending time",
      message: "A last-song time helps the DJ plan a smooth finish instead of stopping suddenly.",
      priority: "helpful",
    });
  }
}

function addEventGuidance(profile: EventProfile, guidance: EventGuidance[]): void {
  const eventType: EventType = profile.eventType;
  if (eventType === "wedding" || eventType === "anniversary") {
    guidance.push({
      title: "Confirm special moments",
      message: "Decide on ceremony music, grand entrance, first dance, parent dances, cake, bouquet toss, and last dance.",
      priority: "important",
    });
  }
  if (eventType === "sweet-16-quinceanera") {
    guidance.push({
      title: "Confirm the traditions",
      message: "Decide on entrance music, court presentation, special dances, candle or shoe ceremony, cake, and the dance-floor opening.",
      priority: "important",
    });
  }
  if (eventType === "corporate") {
    guidance.push({
      title: "Check the workplace rules",
      message: "Confirm the music boundaries, announcement names, microphone needs, and the time when dancing is allowed.",
      priority: "important",
    });
  }
  if (eventType === "graduation" || eventType === "school-college") {
    guidance.push({
      title: "Plan for everyone",
      message: "Choose clean versions when needed and mix familiar songs for different age groups.",
      priority: "helpful",
    });
  }
}

function addAudienceGuidance(profile: EventProfile, guidance: EventGuidance[]): void {
  const groups = profile.audience.groups ?? [];
  if (groups.length > 1) {
    guidance.push({
      title: "Mix the room",
      message: `The audience includes ${groups.join(", ")}. Plan short music runs so every group gets a chance to enjoy the dance floor.`,
      priority: "helpful",
    });
  }
  if (profile.audience.culturalBackground) {
    guidance.push({
      title: "Review cultural requests",
      message: "Use the cultural background note to ask the customer which artists, languages, traditions, and dances they want represented. Do not guess.",
      priority: "important",
    });
  }
}

export function buildEventGuidance(profile: EventProfile): EventGuidance[] {
  const guidance: EventGuidance[] = [];
  addTimelineGuidance(profile, guidance);
  addEventGuidance(profile, guidance);
  addAudienceGuidance(profile, guidance);

  if (profile.mustPlay.length > 0 && profile.doNotPlay.length > 0) {
    guidance.push({
      title: "Protect the customer’s choices",
      message: `${profile.mustPlay.length} must-play request(s) and ${profile.doNotPlay.length} do-not-play request(s) were received. Review the parsed names before the event.`,
      priority: "ready",
    });
  } else if (profile.mustPlay.length === 0) {
    guidance.push({
      title: "Add a few favorite songs",
      message: "A short must-play list helps the DJ understand the customer’s taste and choose safer recommendations.",
      priority: "helpful",
    });
  }

  guidance.push({
    title: "Final check",
    message: "Confirm venue power, speakers, microphone needs, setup access, and the person who can approve song changes during the event.",
    priority: "important",
  });

  return guidance;
}

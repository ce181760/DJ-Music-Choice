import assert from "node:assert/strict";
import test from "node:test";
import { buildGamePlan } from "./gamePlanBuilder.js";
import { KnowledgeBase } from "../knowledge/schema.js";
import { buildEventProfile } from "./profileBuilder.js";
import { buildEnergyCurve } from "./energyCurve.js";

function song(key: string, title: string, artist: string, score: number, tags: Record<string, number>, followUpCounts: Record<string, number> = {}) {
  return {
    key, title, artist, mentions: [], scenarioTagCounts: tags, followUpCounts,
    precededByCounts: {}, channelsPlayedBy: ["Test DJ"], bangerScore: score, updatedAt: "",
  } as KnowledgeBase["songs"][string];
}

test("sequences by gig-log follow-up and avoids adjacent artists", () => {
  const kb: KnowledgeBase = { version: 1, songs: {} };
  kb.songs["usher - yeah"] = song("usher - yeah", "Yeah!", "Usher", 90, { "dance-floor": 2 });
  kb.songs["sean paul - temperature"] = song("sean paul - temperature", "Temperature", "Sean Paul", 88, { "dance-floor": 2 }, { "nelly furtado - promiscuous": 2 });
  kb.songs["nelly furtado - promiscuous"] = song("nelly furtado - promiscuous", "Promiscuous", "Nelly Furtado", 87, { "dance-floor": 2 });
  kb.songs["usher - omg"] = song("usher - omg", "OMG", "Usher", 86, { "dance-floor": 2 });
  kb.songs["usher - yeah"].followUpCounts["sean paul - temperature"] = 4;

  const profile = buildEventProfile({ eventName: "Test party", eventDate: "2026-09-12", eventType: "birthday" });
  const section = buildGamePlan(profile, kb).sections.find((item) => item.section === "dance-floor-opening")!;
  assert.deepEqual(section.tracks.map((track) => track.title), ["Yeah!", "Temperature", "Promiscuous", "OMG"]);
  assert.equal(section.targetEnergy, 7);
  assert.equal(section.energyReset, undefined);
  assert.equal(section.tracks[1].transitionReason?.includes("Yeah!"), true);
  assert.notEqual(section.tracks[0].artist, section.tracks[1].artist);
  assert.notEqual(section.tracks[2].artist, section.tracks[3].artist);
});

test("creates an intentional birthday energy reset before the build", () => {
  const profile = buildEventProfile({
    eventName: "Birthday",
    eventDate: "2026-09-12",
    eventType: "birthday",
    schedule: { guestArrival: "6:00 PM", eventEnd: "10:00 PM" },
    energyPreferences: { peakMinutes: 90 },
  });
  const curve = buildEnergyCurve(profile);
  const reset = curve.points.find((point) => point.reset);

  assert.equal(curve.totalMinutes, 240);
  assert.equal(reset?.resetStyle, "dramatic");
  assert.equal(reset?.resetReason?.includes("sustained"), true);
  assert.equal(reset?.targetEnergy, 4);
});
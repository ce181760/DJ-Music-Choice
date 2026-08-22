import assert from "node:assert/strict";
import test from "node:test";
import { buildEventGuidance } from "./guidance.js";
import { buildEventProfile } from "./profileBuilder.js";

test("gives wedding customers timeline and special-moment guidance", () => {
  const profile = buildEventProfile({
    eventName: "Ava and Leo Wedding",
    eventDate: "2026-10-10",
    eventType: "wedding",
    mustPlayRaw: "Earth, Wind & Fire - September",
    doNotPlayRaw: "Baby Shark",
  });

  const guidance = buildEventGuidance(profile);
  const titles = guidance.map((item) => item.title);

  assert.ok(titles.includes("Make a simple timeline"));
  assert.ok(titles.includes("Confirm special moments"));
  assert.ok(titles.includes("Protect the customer’s choices"));
  assert.ok(titles.includes("Final check"));
});

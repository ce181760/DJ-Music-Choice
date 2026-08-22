import { readFile } from "node:fs/promises";
import { buildEventProfile } from "../events/profileBuilder.js";
import { buildGamePlan } from "../events/gamePlanBuilder.js";
import { saveEvent } from "../events/store.js";
import { loadKnowledgeBase } from "../knowledge/store.js";
import { EventInput } from "../events/schema.js";

/**
 * Turns a customer-meeting questionnaire (JSON file) into an Event Music Profile + DJ Game Plan.
 * See data/events/sample-event-input.json for the expected shape.
 *
 * Usage:
 *   npm run dev:event -- --file data/events/sample-event-input.json
 */
async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  if (fileIdx === -1) {
    console.log("Usage: npm run dev:event -- --file <path-to-event-input.json>");
    return;
  }

  const filePath = args[fileIdx + 1];
  const raw = await readFile(filePath, "utf-8");
  const input = JSON.parse(raw) as EventInput;

  const profile = buildEventProfile(input);
  const kb = await loadKnowledgeBase();
  const gamePlan = buildGamePlan(profile, kb);
  const savedPath = await saveEvent({ profile, gamePlan });

  console.log(`Event: ${profile.eventName}`);
  console.log(`Type: ${profile.eventTypeLabel}`);
  console.log(`Date: ${profile.eventDate}`);
  if (profile.audience.ageRanges?.length) {
    console.log(`Audience: ${profile.audience.ageRanges.join(", ")}`);
  }
  if (profile.audience.culturalBackground) {
    console.log(`Cultural background note: ${profile.audience.culturalBackground}`);
  }
  console.log(`Must Play: ${profile.mustPlay.length} song(s)`);
  console.log(`Do Not Play: ${profile.doNotPlay.length} song(s)\n`);

  console.log("DJ Game Plan:\n");
  for (const section of gamePlan.sections) {
    console.log(`## ${section.section} — ${section.description}`);
    for (const track of section.tracks) {
      const scoreText = track.bangerScore !== undefined ? ` (${track.bangerScore}/100)` : "";
      console.log(
        `  [${track.source}]${scoreText} ${track.artist ?? "Unknown Artist"} - ${track.title}`
      );
      console.log(`    Why: ${track.reason}`);
    }
    console.log("");
  }

  console.log("Notes:");
  for (const note of gamePlan.notes) console.log(`  - ${note}`);

  console.log("\nCustomer Event Guidance:");
  for (const item of gamePlan.guidance) {
    console.log(`  [${item.priority}] ${item.title}`);
    console.log(`    ${item.message}`);
  }

  console.log(`\nSaved event profile + game plan to ${savedPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

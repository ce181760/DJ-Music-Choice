import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DjGamePlan, EventProfile } from "./schema.js";

const EVENTS_DIR = fileURLToPath(new URL("../../data/events/", import.meta.url));

export interface StoredEvent {
  profile: EventProfile;
  gamePlan?: DjGamePlan;
}

export async function saveEvent(event: StoredEvent): Promise<string> {
  await mkdir(EVENTS_DIR, { recursive: true });
  const path = join(EVENTS_DIR, `${event.profile.id}.json`);
  await writeFile(path, JSON.stringify(event, null, 2), "utf-8");
  return path;
}

export async function loadEvent(id: string): Promise<StoredEvent | null> {
  try {
    const raw = await readFile(join(EVENTS_DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as StoredEvent;
  } catch {
    return null;
  }
}

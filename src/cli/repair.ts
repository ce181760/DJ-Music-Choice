import { loadKnowledgeBase, saveKnowledgeBase } from "../knowledge/store.js";
import { repairLegacyPlaylistEntries } from "../knowledge/migrate.js";

async function main() {
  const knowledgeBase = await loadKnowledgeBase();
  const repairedCount = repairLegacyPlaylistEntries(knowledgeBase);
  await saveKnowledgeBase(knowledgeBase);
  console.log(`Repaired ${repairedCount} legacy playlist song record(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

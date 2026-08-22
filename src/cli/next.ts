import { findSong, loadKnowledgeBase, topFollowUps } from "../knowledge/store.js";
import { computeBangerScore } from "../scoring/bangerScore.js";
import { getGigInsights } from "../scoring/insights.js";

/**
 * Suggests what to play next, based on what real DJ gig logs show being played
 * immediately after the given song (ranked by frequency, tie-broken by Banger Score).
 *
 * Usage:
 *   npm run dev:next -- --current "Yeah!"
 *   npm run dev:next -- --current "Yeah!" --artist "Usher"
 */
async function main() {
  const args = process.argv.slice(2);
  const currentIdx = args.indexOf("--current");
  const artistIdx = args.indexOf("--artist");

  const current = currentIdx !== -1 ? args[currentIdx + 1] : undefined;
  const artist = artistIdx !== -1 ? args[artistIdx + 1] : null;

  if (!current) {
    console.log(
      'Usage: npm run dev:next -- --current "Song Title" [--artist "Artist"]'
    );
    return;
  }

  const kb = await loadKnowledgeBase();
  const song = findSong(kb, current, artist);
  if (!song) {
    console.log(`No knowledge yet for "${current}". Run the ingest CLI first.`);
    return;
  }

  const followUps = topFollowUps(kb, song.key, 5);
  if (followUps.length === 0) {
    console.log(
      `No gig-log follow-up data yet for "${song.artist ?? "Unknown"} - ${song.title}". ` +
        `Ingest more DJ gig log videos to learn what's commonly played after it.`
    );
    return;
  }

  console.log(`Current: ${song.artist ?? "Unknown"} - ${song.title}\n`);
  console.log("Recommended next tracks (from real DJ gig logs):\n");
  for (const { song: next, count } of followUps) {
    const { total } = computeBangerScore(next);
    const insights = getGigInsights(next, kb);
    console.log(`🔥 ${next.artist ?? "Unknown Artist"} — ${next.title}`);
    console.log(
      `  Why: played right after this song in ${count} gig log(s); Banger Score ${total}/100; ` +
        `peak-hour strength ${insights.peakHourStrength}%; confidence ${insights.confidence}.\n`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

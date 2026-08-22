import { ingestFromSearch, ingestVideo } from "../pipeline/ingest.js";

function extractVideoId(input: string): string {
  try {
    const url = new URL(input);
    return url.searchParams.get("v") ?? url.pathname.split("/").pop() ?? input;
  } catch {
    return input; // assume it's already a bare video ID
  }
}

/**
 * Usage:
 *   npm run dev:ingest -- --query "50 hip hop songs that always work in the club"
 *   npm run dev:ingest -- --video https://www.youtube.com/watch?v=XXXXXXXXXXX
 */
async function main() {
  const args = process.argv.slice(2);
  const queryIdx = args.indexOf("--query");
  const videoIdx = args.indexOf("--video");

  if (queryIdx !== -1) {
    const query = args[queryIdx + 1];
    if (!query) throw new Error("--query requires a value");
    await ingestFromSearch(query);
    return;
  }

  if (videoIdx !== -1) {
    const videoArg = args[videoIdx + 1];
    if (!videoArg) throw new Error("--video requires a value");
    const videoId = extractVideoId(videoArg);
    const count = await ingestVideo(videoId);
    console.log(`Extracted ${count} candidate song mention(s) from ${videoId}.`);
    return;
  }

  console.log(
    "Usage:\n" +
      '  npm run dev:ingest -- --query "50 hip hop songs that always work in the club"\n' +
      "  npm run dev:ingest -- --video https://www.youtube.com/watch?v=XXXXXXXXXXX"
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

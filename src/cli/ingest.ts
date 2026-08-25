import { ingestFromChannel, ingestFromSearch, ingestVideo } from "../pipeline/ingest.js";
import { extractChannelHandle } from "../youtube/client.js";

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
 *   npm run dev:ingest -- --channel https://www.youtube.com/@NickSpinelli --context "wedding" --max 25
 */
async function main() {
  const args = process.argv.slice(2);
  const queryIdx = args.indexOf("--query");
  const videoIdx = args.indexOf("--video");
  const channelIdx = args.indexOf("--channel");
  const contextIdx = args.indexOf("--context");
  const maxIdx = args.indexOf("--max");

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

  if (channelIdx !== -1) {
    const channelArg = args[channelIdx + 1];
    if (!channelArg) throw new Error("--channel requires a value");
    const handle = extractChannelHandle(channelArg);
    const contextText = contextIdx !== -1 ? args[contextIdx + 1] : "";
    const maxResults = maxIdx !== -1 ? Number(args[maxIdx + 1]) : 25;
    await ingestFromChannel(handle, contextText, maxResults);
    return;
  }

  console.log(
    "Usage:\n" +
      '  npm run dev:ingest -- --query "50 hip hop songs that always work in the club"\n' +
      "  npm run dev:ingest -- --video https://www.youtube.com/watch?v=XXXXXXXXXXX\n" +
      '  npm run dev:ingest -- --channel https://www.youtube.com/@NickSpinelli --context "wedding" --max 25'
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

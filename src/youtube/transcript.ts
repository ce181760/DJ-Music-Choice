import { YoutubeTranscript } from "youtube-transcript";

/**
 * Fetches the public auto-generated/creator captions for a video (text only, no audio/video).
 * Returns "" if captions are disabled or unavailable — callers should fall back to title/description.
 */
export async function getVideoTranscript(videoId: string): Promise<string> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    return segments.map((s) => s.text).join(" ");
  } catch {
    return "";
  }
}

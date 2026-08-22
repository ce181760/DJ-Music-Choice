import { config } from "../config.js";

const API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeVideoSummary {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
}

/** Searches for DJ-oriented videos (e.g. "top club bangers 2024 dj set"). */
export async function searchDjVideos(
  query: string,
  maxResults = 10
): Promise<{ videoId: string; title: string }[]> {
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", config.youtubeApiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    items: { id: { videoId: string }; snippet: { title: string } }[];
  };
  return data.items
    .filter((item) => item.id.videoId)
    .map((item) => ({ videoId: item.id.videoId, title: item.snippet.title }));
}

/** Fetches public metadata (title, description, tags, stats) for a video. No copyrighted media is downloaded. */
export async function getVideoDetails(
  videoId: string
): Promise<YouTubeVideoSummary | null> {
  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", config.youtubeApiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube video lookup failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    items: {
      id: string;
      snippet: {
        title: string;
        description: string;
        channelTitle: string;
        publishedAt: string;
        tags?: string[];
      };
      statistics: { viewCount?: string; likeCount?: string };
    }[];
  };
  const item = data.items[0];
  if (!item) return null;
  return {
    videoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    tags: item.snippet.tags ?? [],
    viewCount: Number(item.statistics.viewCount ?? 0),
    likeCount: Number(item.statistics.likeCount ?? 0),
  };
}

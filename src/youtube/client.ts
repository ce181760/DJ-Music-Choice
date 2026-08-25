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
): Promise<YouTubeVideoSummary | null> {  const url = new URL(`${API_BASE}/videos`);
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

/** Extracts the @handle from a full channel URL, or returns the input unchanged if it's already a bare handle. */
export function extractChannelHandle(input: string): string {
  try {
    const url = new URL(input);
    const segment = url.pathname.split("/").filter(Boolean).pop() ?? input;
    return segment.startsWith("@") ? segment : `@${segment}`;
  } catch {
    return input.startsWith("@") ? input : `@${input}`;
  }
}

/** Resolves a channel handle (e.g. "@NickSpinelli") to its uploads playlist ID. */
async function getUploadsPlaylistId(handle: string): Promise<string | null> {
  const url = new URL(`${API_BASE}/channels`);
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("forHandle", handle.replace(/^@/, ""));
  url.searchParams.set("key", config.youtubeApiKey);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube channel lookup failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    items: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
  };
  return data.items[0]?.contentDetails.relatedPlaylists.uploads ?? null;
}

/** Lists the most recent video IDs uploaded by a channel, given its handle (e.g. "@NickSpinelli"). */
export async function getChannelUploads(
  handle: string,
  maxResults = 25
): Promise<{ videoId: string; title: string }[]> {
  const uploadsPlaylistId = await getUploadsPlaylistId(handle);
  if (!uploadsPlaylistId) return [];

  const results: { videoId: string; title: string }[] = [];
  let pageToken: string | undefined;

  while (results.length < maxResults) {
    const url = new URL(`${API_BASE}/playlistItems`);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", uploadsPlaylistId);
    url.searchParams.set("maxResults", String(Math.min(50, maxResults - results.length)));
    url.searchParams.set("key", config.youtubeApiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`YouTube playlist lookup failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as {
      items: { snippet: { title: string; resourceId: { videoId: string } } }[];
      nextPageToken?: string;
    };
    for (const item of data.items) {
      results.push({ videoId: item.snippet.resourceId.videoId, title: item.snippet.title });
    }
    if (!data.nextPageToken || data.items.length === 0) break;
    pageToken = data.nextPageToken;
  }

  return results.slice(0, maxResults);
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { config } from "@/lib/config.server";

const inputSchema = z.object({
  url: z.string().min(5),
});

type PlaylistItem = {
  title: string;
  videoId: string;
  durationMinutes: number | null;
};

type PlaylistResponse = {
  id: string;
  title: string;
  items: PlaylistItem[];
};

function parsePlaylistId(input: string) {
  try {
    const url = new URL(input);
    const listId = url.searchParams.get("list");
    if (listId) return listId;
    return null;
  } catch {
    // Not a URL, continue
  }

  const trimmed = input.trim();
  const playlistIdPattern = /^(PL|UU|LL|FL|OLAK5uy_)[a-zA-Z0-9_-]{10,}$/;
  return playlistIdPattern.test(trimmed) ? trimmed : null;
}

function parseIsoDuration(duration: string) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return Math.round(hours * 60 + minutes + seconds / 60);
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `YouTube API error (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[] } };
      const reason = data.error?.errors?.[0]?.reason;
      const apiMessage = data.error?.message;
      if (apiMessage && reason) {
        message = `${apiMessage} (${reason})`;
      } else if (apiMessage) {
        message = apiMessage;
      }
    } catch {
      const text = await res.text();
      if (text) message = `${message}: ${text}`;
    }
    throw new Error(message);
  }
  return res.json() as Promise<any>;
}

async function fetchPlaylistTitle(playlistId: string, apiKey: string) {
  const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
  const data = await fetchJson(url);
  const title = data.items?.[0]?.snippet?.title;
  return typeof title === "string" ? title : "Playlist";
}

async function fetchPlaylistItems(playlistId: string, apiKey: string) {
  let pageToken: string | undefined;
  const items: { title: string; videoId: string }[] = [];

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const data = await fetchJson(url.toString());
    const pageItems = data.items ?? [];
    pageItems.forEach((item: any) => {
      const title = item.snippet?.title ?? "Untitled";
      const videoId = item.contentDetails?.videoId;
      if (videoId) {
        items.push({ title, videoId });
      }
    });
    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

async function fetchDurations(videoIds: string[], apiKey: string) {
  if (!videoIds.length) return new Map<string, number | null>();
  const result = new Map<string, number | null>();

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", apiKey);

    const data = await fetchJson(url.toString());
    (data.items ?? []).forEach((item: any) => {
      const id = item.id;
      const duration = item.contentDetails?.duration;
      result.set(id, duration ? parseIsoDuration(duration) : null);
    });
  }

  return result;
}

export const importYouTubePlaylist = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const apiKey = config.youtubeApiKey;
    if (!apiKey) {
      throw new Error("Missing YOUTUBE_API_KEY in .env");
    }

    const playlistId = parsePlaylistId(data.url.trim());
    if (!playlistId) {
      throw new Error("Invalid playlist URL. Paste a YouTube playlist link with ?list=...");
    }

    const title = await fetchPlaylistTitle(playlistId, apiKey);
    const items = await fetchPlaylistItems(playlistId, apiKey);
    const durationMap = await fetchDurations(items.map((i) => i.videoId), apiKey);

    const enriched: PlaylistItem[] = items.map((item) => ({
      title: item.title,
      videoId: item.videoId,
      durationMinutes: durationMap.get(item.videoId) ?? null,
    }));

    const response: PlaylistResponse = {
      id: playlistId,
      title,
      items: enriched,
    };

    return response;
  });

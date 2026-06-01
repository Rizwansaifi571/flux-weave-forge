import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importYouTubePlaylist } from "@/lib/api/youtube.functions";
import type { RoadmapSource } from "@/lib/ai/task-ai.shared";

const inputSchema = z.object({
  input: z.string().min(1),
});

const urlPattern = /https?:\/\/[^\s<>"')]+/gi;

function extractUrls(input: string) {
  return Array.from(input.matchAll(urlPattern)).map((match) => match[0]);
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " "),
  );
}

function extractTitle(html: string, fallback: string) {
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  )?.[1];
  if (ogTitle) return decodeEntities(ogTitle).trim();

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (titleTag) return decodeEntities(titleTag).trim();

  return fallback;
}

function extractMeaningfulLines(text: string) {
  const stopWords = new Set([
    "home",
    "skip to content",
    "privacy policy",
    "terms of service",
    "cookie policy",
    "sign in",
    "sign up",
  ]);

  return Array.from(
    new Set(
      text
        .split("\n")
        .map((line) => line.trim().replace(/\s+/g, " "))
        .filter((line) => line.length >= 4 && line.length <= 180)
        .filter((line) => !stopWords.has(line.toLowerCase()))
        .filter((line) => !/^(true|false)\s+\d{1,2}:\d{2}\s+now playing$/i.test(line)),
    ),
  ).slice(0, 120);
}

async function fetchGenericPage(url: string): Promise<RoadmapSource> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; CodexRoadmapBot/1.0)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Could not read ${url} (${response.status})`);
  }

  const html = await response.text();
  const title = extractTitle(html, new URL(url).hostname);
  const text = stripHtml(html);
  const lines = extractMeaningfulLines(text);

  return {
    kind: "webpage",
    title,
    url,
    summary: lines.slice(0, 40).join("\n"),
    items: lines.map((line) => ({
      title: line,
      durationMinutes: null,
      url,
    })),
  };
}

async function fetchRoadmapSourceFromUrl(url: string): Promise<RoadmapSource> {
  const normalizedUrl = url.trim();
  if (/youtube\.com\/.*list=|youtu\.be\//i.test(normalizedUrl)) {
    const playlist = await importYouTubePlaylist({ data: { url: normalizedUrl } });
    return {
      kind: "youtube_playlist",
      title: playlist.title,
      url: normalizedUrl,
      summary: playlist.items
        .slice(0, 40)
        .map((item) => `${item.title}${item.durationMinutes ? ` (${item.durationMinutes}m)` : ""}`)
        .join("\n"),
      items: playlist.items.map((item) => ({
        title: item.title,
        durationMinutes: item.durationMinutes,
        url: normalizedUrl,
      })),
    };
  }

  return fetchGenericPage(normalizedUrl);
}

export const extractRoadmapSource = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const urls = extractUrls(data.input);
    if (urls.length === 0) {
      return null;
    }

    const source = await fetchRoadmapSourceFromUrl(urls[0]);
    return source;
  });

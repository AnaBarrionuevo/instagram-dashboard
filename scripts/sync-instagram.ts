/**
 * Fetches recent Instagram posts and writes them to knowledge/instagram-agenda.txt.
 * Run `npm run knowledge:setup` afterward to upload the updated file to the vector store.
 *
 * Env (from .env.local):
 *   PAGE_ACCESS_TOKEN or INSTAGRAM_TOKEN
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID (default account)
 *   INSTAGRAM_FEED_ACCOUNT_ID (optional — another connected business account)
 *   INSTAGRAM_FEED_DAYS (optional — default 30)
 */

import fs from "fs";
import path from "path";
import { loadEnvLocal } from "./lib/load-env";

loadEnvLocal();

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const OUTPUT_FILE = path.join(KNOWLEDGE_DIR, "instagram-agenda.txt");

interface InstagramMedia {
  id: string;
  caption?: string;
  timestamp?: string;
  permalink?: string;
  media_type?: string;
}

interface MediaResponse {
  data?: InstagramMedia[];
  paging?: { next?: string };
  error?: { message: string; code?: number };
}

type TokenSource = "instagram" | "page";

function getTokenCandidates(): Array<{ token: string; source: TokenSource }> {
  const candidates: Array<{ token: string; source: TokenSource }> = [];

  if (process.env.INSTAGRAM_TOKEN) {
    candidates.push({
      token: process.env.INSTAGRAM_TOKEN,
      source: "instagram",
    });
  }
  if (process.env.PAGE_ACCESS_TOKEN) {
    candidates.push({
      token: process.env.PAGE_ACCESS_TOKEN,
      source: "page",
    });
  }

  if (candidates.length === 0) {
    throw new Error(
      "Missing PAGE_ACCESS_TOKEN or INSTAGRAM_TOKEN in .env.local"
    );
  }

  return candidates;
}

function isAuthError(message: string): boolean {
  return /access token|session has expired|oauth|invalid_token/i.test(message);
}

function getAccountId(): string {
  const accountId =
    process.env.INSTAGRAM_FEED_ACCOUNT_ID ??
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accountId) {
    throw new Error(
      "Missing INSTAGRAM_BUSINESS_ACCOUNT_ID (or INSTAGRAM_FEED_ACCOUNT_ID) in .env.local"
    );
  }
  return accountId;
}

function buildMediaUrl(
  accountId: string,
  token: string,
  source: TokenSource
): string {
  const fields = "id,caption,timestamp,permalink,media_type";

  if (source === "page") {
    return `https://graph.facebook.com/v21.0/${accountId}/media?fields=${fields}&limit=25&access_token=${token}`;
  }

  if (accountId === process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    return `https://graph.instagram.com/v25.0/me/media?fields=${fields}&limit=25&access_token=${token}`;
  }

  return `https://graph.instagram.com/v25.0/${accountId}/media?fields=${fields}&limit=25&access_token=${token}`;
}

async function fetchMediaWithFallback(
  accountId: string
): Promise<InstagramMedia[]> {
  const candidates = getTokenCandidates();
  let lastError: Error | null = null;

  for (const { token, source } of candidates) {
    try {
      console.log(`[sync-instagram] Trying ${source} token...`);
      return await fetchAllMedia(buildMediaUrl(accountId, token, source));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);

      if (isAuthError(message) && candidates.length > 1) {
        console.warn(`[sync-instagram] ${source} token failed: ${message}`);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error("No token available");
}

async function fetchAllMedia(
  initialUrl: string
): Promise<InstagramMedia[]> {
  const posts: InstagramMedia[] = [];
  let url: string | undefined = initialUrl;

  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as MediaResponse;

    if (!res.ok || json.error) {
      throw new Error(
        json.error?.message ?? `Instagram API error (${res.status})`
      );
    }

    posts.push(...(json.data ?? []));
    url = json.paging?.next;
  }

  return posts;
}

function filterByDays(posts: InstagramMedia[], days: number): InstagramMedia[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return posts.filter((post) => {
    if (!post.timestamp) return true;
    return new Date(post.timestamp).getTime() >= cutoff;
  });
}

function formatAgendaFile(posts: InstagramMedia[], accountId: string): string {
  const generatedAt = new Date().toISOString();
  const lines: string[] = [
    "Instagram feed — weekly agenda and updates",
    `Generated: ${generatedAt}`,
    `Account ID: ${accountId}`,
    "",
    "Use this section for current schedules, events, and announcements from recent posts.",
    "",
  ];

  if (posts.length === 0) {
    lines.push("No posts found in the selected time range.");
    return lines.join("\n");
  }

  for (const post of posts) {
    const date = post.timestamp
      ? new Date(post.timestamp).toISOString().slice(0, 10)
      : "unknown date";

    lines.push(`--- Post ${date} (${post.media_type ?? "media"}) ---`);
    lines.push(post.caption?.trim() || "(no caption)");
    if (post.permalink) lines.push(`Link: ${post.permalink}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

async function main() {
  const accountId = getAccountId();
  const days = Number(process.env.INSTAGRAM_FEED_DAYS ?? "30");

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  console.log(`[sync-instagram] Fetching media for account ${accountId}...`);

  const allPosts = await fetchMediaWithFallback(accountId);
  const recentPosts = filterByDays(allPosts, days);

  console.log(
    `[sync-instagram] ${recentPosts.length} post(s) in the last ${days} day(s) (${allPosts.length} fetched)`
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    formatAgendaFile(recentPosts, accountId),
    "utf8"
  );

  console.log(`[sync-instagram] Wrote ${OUTPUT_FILE}`);
  console.log("[sync-instagram] Run npm run knowledge:setup to refresh the vector store.");
}

main().catch((err) => {
  console.error("[sync-instagram] Error:", err);
  process.exit(1);
});

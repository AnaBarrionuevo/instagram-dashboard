export interface InstagramMedia {
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

export interface InstagramFeedConfig {
  accountId: string;
  days: number;
  instagramToken?: string;
  pageAccessToken?: string;
}

function getTokenCandidates(
  config: InstagramFeedConfig
): Array<{ token: string; source: TokenSource }> {
  const candidates: Array<{ token: string; source: TokenSource }> = [];

  if (config.instagramToken) {
    candidates.push({ token: config.instagramToken, source: "instagram" });
  }
  if (config.pageAccessToken) {
    candidates.push({ token: config.pageAccessToken, source: "page" });
  }

  if (candidates.length === 0) {
    throw new Error("Missing PAGE_ACCESS_TOKEN or INSTAGRAM_TOKEN");
  }

  return candidates;
}

function isAuthError(message: string): boolean {
  return /access token|session has expired|oauth|invalid_token/i.test(message);
}

function buildMediaUrl(
  accountId: string,
  token: string,
  source: TokenSource,
  businessAccountId?: string
): string {
  const fields = "id,caption,timestamp,permalink,media_type";

  if (source === "page") {
    return `https://graph.facebook.com/v21.0/${accountId}/media?fields=${fields}&limit=25&access_token=${token}`;
  }

  if (accountId === businessAccountId) {
    return `https://graph.instagram.com/v25.0/me/media?fields=${fields}&limit=25&access_token=${token}`;
  }

  return `https://graph.instagram.com/v25.0/${accountId}/media?fields=${fields}&limit=25&access_token=${token}`;
}

async function fetchAllMedia(initialUrl: string): Promise<InstagramMedia[]> {
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

async function fetchMediaWithFallback(
  config: InstagramFeedConfig
): Promise<InstagramMedia[]> {
  const candidates = getTokenCandidates(config);
  let lastError: Error | null = null;

  for (const { token, source } of candidates) {
    try {
      return await fetchAllMedia(
        buildMediaUrl(
          config.accountId,
          token,
          source,
          process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);

      if (isAuthError(message) && candidates.length > 1) {
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error("No token available");
}

function filterByDays(posts: InstagramMedia[], days: number): InstagramMedia[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return posts.filter((post) => {
    if (!post.timestamp) return true;
    return new Date(post.timestamp).getTime() >= cutoff;
  });
}

export function formatAgendaFile(
  posts: InstagramMedia[],
  accountId: string
): string {
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

export function instagramFeedConfigFromEnv(): InstagramFeedConfig {
  const accountId =
    process.env.INSTAGRAM_FEED_ACCOUNT_ID ??
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!accountId) {
    throw new Error(
      "Missing INSTAGRAM_BUSINESS_ACCOUNT_ID (or INSTAGRAM_FEED_ACCOUNT_ID)"
    );
  }

  return {
    accountId,
    days: Number(process.env.INSTAGRAM_FEED_DAYS ?? "30"),
    instagramToken: process.env.INSTAGRAM_TOKEN,
    pageAccessToken: process.env.PAGE_ACCESS_TOKEN,
  };
}

export function mergeInstagramTokens(
  base: InstagramFeedConfig,
  overrides?: Pick<InstagramFeedConfig, "instagramToken" | "pageAccessToken">
): InstagramFeedConfig {
  return {
    ...base,
    instagramToken: overrides?.instagramToken ?? base.instagramToken,
    pageAccessToken: overrides?.pageAccessToken ?? base.pageAccessToken,
  };
}

export async function fetchRecentInstagramPosts(
  config: InstagramFeedConfig
): Promise<InstagramMedia[]> {
  const allPosts = await fetchMediaWithFallback(config);
  return filterByDays(allPosts, config.days);
}

export async function buildInstagramAgendaContent(
  config?: InstagramFeedConfig
): Promise<{ content: string; postCount: number; accountId: string }> {
  const resolved = config ?? instagramFeedConfigFromEnv();
  const posts = await fetchRecentInstagramPosts(resolved);

  return {
    content: formatAgendaFile(posts, resolved.accountId),
    postCount: posts.length,
    accountId: resolved.accountId,
  };
}

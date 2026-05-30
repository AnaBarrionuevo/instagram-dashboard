/**
 * Refreshes Meta / Instagram access tokens before they expire.
 *
 * Important: refresh only works while the token is still valid. Once expired
 * (like in "Session has expired"), you must generate a new token in Meta's
 * dashboard and paste it into .env.local — then run this script on a schedule.
 *
 * Usage:
 *   npm run meta:refresh-token
 *
 * Env:
 *   INSTAGRAM_TOKEN          — refreshed via ig_refresh_token (60-day tokens)
 *   META_APP_ID              — Facebook app ID (for page token chain)
 *   META_APP_SECRET          — Facebook app secret
 *   META_LONG_LIVED_USER_TOKEN — long-lived Facebook user token (for page token)
 *   FACEBOOK_PAGE_ID         — optional; auto-detected from /me/accounts if omitted
 */

import { loadEnvLocal } from "./lib/load-env";
import { setEnvLocal } from "./lib/env-file";

loadEnvLocal();

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: { message: string; type?: string; code?: number };
}

interface AccountsResponse {
  data?: Array<{
    id: string;
    name?: string;
    access_token?: string;
    instagram_business_account?: { id: string };
  }>;
  error?: { message: string };
}

async function refreshInstagramToken(
  currentToken: string
): Promise<{ token: string; expiresIn?: number }> {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", currentToken);

  const res = await fetch(url);
  const json = (await res.json()) as TokenResponse;

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error?.message ??
        "Instagram token refresh failed — generate a new token in Meta and update INSTAGRAM_TOKEN"
    );
  }

  return { token: json.access_token, expiresIn: json.expires_in };
}

async function exchangeFacebookUserToken(
  currentUserToken: string
): Promise<{ token: string; expiresIn?: number }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Missing META_APP_ID or META_APP_SECRET — required to refresh PAGE_ACCESS_TOKEN"
    );
  }

  const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentUserToken);

  const res = await fetch(url);
  const json = (await res.json()) as TokenResponse;

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error?.message ??
        "Facebook user token exchange failed — re-authenticate in Meta and update META_LONG_LIVED_USER_TOKEN"
    );
  }

  return { token: json.access_token, expiresIn: json.expires_in };
}

async function fetchPageAccessToken(
  userToken: string
): Promise<{ pageId: string; token: string }> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (pageId) {
    const url = new URL(`https://graph.facebook.com/v21.0/${pageId}`);
    url.searchParams.set("fields", "access_token");
    url.searchParams.set("access_token", userToken);

    const res = await fetch(url);
    const json = (await res.json()) as { access_token?: string; error?: { message: string } };

    if (!res.ok || !json.access_token) {
      throw new Error(json.error?.message ?? "Failed to fetch page access token");
    }

    return { pageId, token: json.access_token };
  }

  const url = new URL("https://graph.facebook.com/v21.0/me/accounts");
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account"
  );
  url.searchParams.set("access_token", userToken);

  const res = await fetch(url);
  const json = (await res.json()) as AccountsResponse;

  if (!res.ok || !json.data?.length) {
    throw new Error(
      json.error?.message ??
        "No Facebook pages found — set FACEBOOK_PAGE_ID or reconnect the Instagram account in Meta"
    );
  }

  const match = igAccountId
    ? json.data.find(
        (p) => p.instagram_business_account?.id === igAccountId
      )
    : undefined;
  const page = match ?? json.data[0];

  if (!page?.access_token) {
    throw new Error("Could not resolve a page access token from /me/accounts");
  }

  return { pageId: page.id, token: page.access_token };
}

function formatExpiry(expiresIn?: number): string {
  if (!expiresIn) return "unknown expiry";
  const days = Math.round(expiresIn / 86400);
  return `expires in ~${days} day(s)`;
}

async function main() {
  let refreshed = false;

  const instagramToken = process.env.INSTAGRAM_TOKEN;
  if (instagramToken) {
    console.log("[refresh] Refreshing INSTAGRAM_TOKEN...");
    const { token, expiresIn } = await refreshInstagramToken(instagramToken);
    setEnvLocal("INSTAGRAM_TOKEN", token);
    process.env.INSTAGRAM_TOKEN = token;
    console.log(`[refresh] ✓ INSTAGRAM_TOKEN updated (${formatExpiry(expiresIn)})`);
    refreshed = true;
  }

  const userToken = process.env.META_LONG_LIVED_USER_TOKEN;
  if (userToken) {
    console.log("[refresh] Exchanging META_LONG_LIVED_USER_TOKEN...");
    const { token: newUserToken, expiresIn } =
      await exchangeFacebookUserToken(userToken);
    setEnvLocal("META_LONG_LIVED_USER_TOKEN", newUserToken);
    process.env.META_LONG_LIVED_USER_TOKEN = newUserToken;
    console.log(
      `[refresh] ✓ META_LONG_LIVED_USER_TOKEN updated (${formatExpiry(expiresIn)})`
    );

    console.log("[refresh] Fetching PAGE_ACCESS_TOKEN from connected page...");
    const { pageId, token: pageToken } = await fetchPageAccessToken(newUserToken);
    setEnvLocal("PAGE_ACCESS_TOKEN", pageToken);
    if (!process.env.FACEBOOK_PAGE_ID) {
      setEnvLocal("FACEBOOK_PAGE_ID", pageId);
    }
    process.env.PAGE_ACCESS_TOKEN = pageToken;
    console.log(`[refresh] ✓ PAGE_ACCESS_TOKEN updated (page ${pageId})`);
    refreshed = true;
  }

  if (!refreshed) {
    console.error(
      "[refresh] Nothing to refresh. Set INSTAGRAM_TOKEN and/or META_LONG_LIVED_USER_TOKEN in .env.local"
    );
    console.error(
      "\nIf tokens are already expired, generate new ones in Meta for Developers"
    );
    console.error("(Graph API Explorer or Instagram > API setup with Instagram login).");
    process.exit(1);
  }

  console.log("\n[refresh] Done. Tokens saved to .env.local");
  console.log(
    "[refresh] Tip: run this weekly (cron) before tokens expire — expired tokens cannot be refreshed."
  );
}

main().catch((err) => {
  console.error("[refresh] Error:", err instanceof Error ? err.message : err);
  console.error(
    "\nExpired tokens require manual re-auth in Meta. After updating .env.local, run:"
  );
  console.error("  npm run meta:refresh-token   # schedule weekly while still valid");
  process.exit(1);
});

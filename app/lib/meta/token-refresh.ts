import { getTokenStoreState, setTokenStoreState } from "@/app/lib/token-store";

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

export type RefreshTokensResult = {
  refreshed: boolean;
  instagramToken?: { token: string; expiresIn?: number };
  metaLongLivedUserToken?: { token: string; expiresIn?: number };
  pageAccessToken?: { pageId: string; token: string };
};

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
        "Instagram token refresh failed — token may be expired"
    );
  }

  return { token: json.access_token, expiresIn: json.expires_in };
}

async function exchangeFacebookUserToken(
  currentUserToken: string,
  appId: string,
  appSecret: string
): Promise<{ token: string; expiresIn?: number }> {
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
        "Facebook user token exchange failed — re-authenticate in Meta"
    );
  }

  return { token: json.access_token, expiresIn: json.expires_in };
}

async function fetchPageAccessToken(params: {
  userToken: string;
  pageId?: string;
  igAccountId?: string;
}): Promise<{ pageId: string; token: string }> {
  const { userToken, pageId, igAccountId } = params;

  if (pageId) {
    const url = new URL(`https://graph.facebook.com/v21.0/${pageId}`);
    url.searchParams.set("fields", "access_token");
    url.searchParams.set("access_token", userToken);

    const res = await fetch(url);
    const json = (await res.json()) as {
      access_token?: string;
      error?: { message: string };
    };

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
        "No Facebook pages found — set FACEBOOK_PAGE_ID or reconnect in Meta"
    );
  }

  const match = igAccountId
    ? json.data.find((p) => p.instagram_business_account?.id === igAccountId)
    : undefined;
  const page = match ?? json.data[0];

  if (!page?.access_token) {
    throw new Error("Could not resolve a page access token from /me/accounts");
  }

  return { pageId: page.id, token: page.access_token };
}

async function getSeedTokensFromEnvOrStore() {
  const store = await getTokenStoreState();
  return {
    instagramToken: store?.instagramToken ?? process.env.INSTAGRAM_TOKEN,
    metaLongLivedUserToken:
      store?.metaLongLivedUserToken ?? process.env.META_LONG_LIVED_USER_TOKEN,
    facebookPageId: store?.facebookPageId ?? process.env.FACEBOOK_PAGE_ID,
  };
}

export async function refreshMetaTokensToStore(): Promise<RefreshTokensResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const igAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  const seed = await getSeedTokensFromEnvOrStore();
  let refreshed = false;

  const result: RefreshTokensResult = { refreshed: false };

  if (seed.instagramToken) {
    const refreshedIg = await refreshInstagramToken(seed.instagramToken);
    await setTokenStoreState({ instagramToken: refreshedIg.token });
    result.instagramToken = refreshedIg;
    refreshed = true;
  }

  if (seed.metaLongLivedUserToken && appId && appSecret) {
    const exchanged = await exchangeFacebookUserToken(
      seed.metaLongLivedUserToken,
      appId,
      appSecret
    );
    await setTokenStoreState({ metaLongLivedUserToken: exchanged.token });
    result.metaLongLivedUserToken = exchanged;

    const page = await fetchPageAccessToken({
      userToken: exchanged.token,
      pageId: seed.facebookPageId,
      igAccountId,
    });
    await setTokenStoreState({ pageAccessToken: page.token, facebookPageId: page.pageId });
    result.pageAccessToken = page;
    refreshed = true;
  }

  result.refreshed = refreshed;
  return result;
}


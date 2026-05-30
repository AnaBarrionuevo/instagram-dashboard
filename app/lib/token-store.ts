type TokenStoreState = {
  instagramToken?: string;
  pageAccessToken?: string;
  metaLongLivedUserToken?: string;
  facebookPageId?: string;
  updatedAt?: string;
};

const TOKENS_KEY = "instagram-dashboard:tokens";

function hasKvConfig(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL ||
      process.env.KV_REST_API_TOKEN ||
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function getKv() {
  // Only import when configured (keeps local dev/scripts working).
  const mod = await import("@vercel/kv");
  return mod.kv;
}

export async function getTokenStoreState(): Promise<TokenStoreState | null> {
  if (!hasKvConfig()) return null;
  const kv = await getKv();

  const state = (await kv.get(TOKENS_KEY)) as TokenStoreState | null;
  return state ?? null;
}

export async function setTokenStoreState(
  partial: Omit<TokenStoreState, "updatedAt"> & { updatedAt?: string }
): Promise<void> {
  if (!hasKvConfig()) return;
  const kv = await getKv();

  const current = (await kv.get(TOKENS_KEY)) as TokenStoreState | null;
  const next: TokenStoreState = {
    ...(current ?? {}),
    ...partial,
    updatedAt: partial.updatedAt ?? new Date().toISOString(),
  };

  await kv.set(TOKENS_KEY, next);
}

/** Instagram User token for messaging — KV first, then env. */
export async function getInstagramAccessToken(): Promise<string | null> {
  const stored = await getTokenStoreState();
  return stored?.instagramToken ?? process.env.INSTAGRAM_TOKEN ?? null;
}


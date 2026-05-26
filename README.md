# Instagram Dashboard

A Next.js app that receives Instagram DMs via Meta webhooks and replies automatically using OpenAI. Answers are grounded in a file-based knowledge base (PDF, DOCX, TXT) and can include recent posts synced from your Instagram account (weekly agenda, events, etc.).

## Features

- **Instagram DM webhook** — Meta webhook verification (`GET`) and event handling (`POST`) at `/api/webhook`
- **AI auto-replies** — Incoming text messages get a response via the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) with `gpt-4o-mini`
- **Knowledge base (file search)** — Documents in `/knowledge` are uploaded to an OpenAI vector store and searched at reply time
- **Instagram feed sync** — Fetches recent post captions into `knowledge/instagram-agenda.txt` for up-to-date schedules and announcements (Option B: batch sync, not per-message API calls)
- **Conversation memory** — Chains replies per sender with `previous_response_id` (in-memory; resets on server restart)
- **Configurable persona** — System instructions live in `app/lib/openai.ts` (edit and restart the dev server; no vector store refresh needed)

## Project structure

```
app/
  api/webhook/route.ts      # Meta webhook endpoint
  lib/openai.ts             # OpenAI Responses API + instructions
  lib/instagram.ts          # Send DM replies
  services/webhook.service.ts
knowledge/                  # Source files for the vector store
scripts/
  setup-assistant.ts        # Create or refresh OpenAI vector store
  sync-instagram.ts         # Pull IG posts → instagram-agenda.txt
  refresh-meta-token.ts     # Refresh Meta tokens before they expire
```

## Prerequisites

- Node.js 20+
- A [Meta app](https://developers.facebook.com/) with Instagram messaging / webhooks configured
- An [OpenAI API key](https://platform.openai.com/api-keys)
- Instagram **Business** or **Creator** account connected to the Meta app

## Environment variables

Create `.env.local` in the project root:

```env
# Meta webhook
WEBHOOK_VERIFY_TOKEN=your_verify_token

# Instagram (messaging)
INSTAGRAM_TOKEN=...
INSTAGRAM_BUSINESS_ACCOUNT_ID=...
INSTAGRAM_USER_ID=...

# Instagram (optional — used by knowledge:sync-instagram)
PAGE_ACCESS_TOKEN=...
INSTAGRAM_FEED_ACCOUNT_ID=...   # optional; defaults to INSTAGRAM_BUSINESS_ACCOUNT_ID
INSTAGRAM_FEED_DAYS=30          # optional; how many days of posts to include

# Token refresh (optional — npm run meta:refresh-token)
META_APP_ID=...
META_APP_SECRET=...
META_LONG_LIVED_USER_TOKEN=...  # Facebook user token; used to renew PAGE_ACCESS_TOKEN
FACEBOOK_PAGE_ID=...            # optional; auto-detected if omitted

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_VECTOR_STORE_ID=vs_...   # from npm run knowledge:setup
```

## Setup

### 1. Install and run locally

```bash
npm install
npm run dev
```

Expose the app to Meta (e.g. with [ngrok](https://ngrok.com/)):

```bash
ngrok http 3000
```

Set the webhook URL in the Meta dashboard to `https://<your-host>/api/webhook` and use the same `WEBHOOK_VERIFY_TOKEN`.

### 2. Knowledge base (first time)

1. Add files to `knowledge/` (`.pdf`, `.docx`, `.txt` — see `knowledge/README.md`).
2. Upload them to OpenAI:

```bash
npm run knowledge:setup
```

3. Copy the printed `OPENAI_VECTOR_STORE_ID` into `.env.local`.
4. Wait a minute for OpenAI to finish indexing, then test via DM.

### 3. Keep agenda / feed content fresh (weekly)

Sync Instagram captions into the knowledge folder, then refresh the vector store:

```bash
npm run knowledge:sync-instagram   # → knowledge/instagram-agenda.txt
npm run knowledge:setup            # re-upload all /knowledge files
```

Or both in one step:

```bash
npm run knowledge:refresh
```

Re-run `knowledge:setup` or `knowledge:refresh` whenever you change files in `/knowledge` or want newer Instagram posts in the bot’s context. **You do not need to re-run setup after editing the prompt** in `app/lib/openai.ts` — only restart the dev server.

### 4. Keeping Meta tokens valid

Meta access tokens **expire**. You can refresh them programmatically **only while they are still valid** — once you see `Session has expired`, generate a new token in the [Meta for Developers](https://developers.facebook.com/) dashboard and update `.env.local`.

**While tokens are still valid**, run weekly (or add to cron):

```bash
npm run meta:refresh-token
```

This script:

- Refreshes `INSTAGRAM_TOKEN` via Instagram’s `ig_refresh_token` endpoint (extends ~60 days).
- If `META_APP_ID`, `META_APP_SECRET`, and `META_LONG_LIVED_USER_TOKEN` are set, exchanges the Facebook user token and writes a new `PAGE_ACCESS_TOKEN` to `.env.local`.

`knowledge:refresh` attempts token refresh first, then syncs Instagram and updates the vector store.

**Right now (expired token):** paste a fresh `INSTAGRAM_TOKEN` and/or `PAGE_ACCESS_TOKEN` from Meta, then schedule `meta:refresh-token` before the next expiry.

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run knowledge:setup` | Upload `/knowledge` to OpenAI vector store (create or refresh) |
| `npm run knowledge:sync-instagram` | Fetch recent IG posts → `knowledge/instagram-agenda.txt` |
| `npm run knowledge:refresh` | Refresh Meta tokens (if possible) + sync Instagram + refresh vector store |
| `npm run meta:refresh-token` | Extend valid Instagram / Facebook tokens; updates `.env.local` |

## Customizing the assistant

Edit the `instructions` string in `app/lib/openai.ts`. That text is sent on every reply and defines tone, role, and fallback behavior (e.g. Linktree / @handle).

Stable facts (menus, policies, long docs) belong in `/knowledge`. Time-sensitive content (weekly agenda) is a good fit for `knowledge:sync-instagram`.

## How a DM is handled

1. Meta sends a `POST` to `/api/webhook`.
2. `webhook.service.ts` ignores echoes, reactions, and read receipts; processes incoming text DMs.
3. `generateAIResponse()` calls OpenAI with `file_search` on your vector store and optional `previous_response_id` for the same sender.
4. `sendInstagramMessage()` replies via the Instagram Graph API.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router)
- [OpenAI Node SDK](https://github.com/openai/openai-node) — Responses API (Assistants API is deprecated as of 2026)
- TypeScript, Tailwind CSS

## License

Private project.

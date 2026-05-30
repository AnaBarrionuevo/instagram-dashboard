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
import {
  buildInstagramAgendaContent,
  instagramFeedConfigFromEnv,
} from "../app/lib/knowledge/instagram-feed";
import { loadEnvLocal } from "./lib/load-env";

loadEnvLocal();

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const OUTPUT_FILE = path.join(KNOWLEDGE_DIR, "instagram-agenda.txt");

async function main() {
  const config = instagramFeedConfigFromEnv();

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  console.log(
    `[sync-instagram] Fetching media for account ${config.accountId}...`
  );

  const { content, postCount } = await buildInstagramAgendaContent(config);

  console.log(
    `[sync-instagram] ${postCount} post(s) in the last ${config.days} day(s)`
  );

  fs.writeFileSync(OUTPUT_FILE, content, "utf8");

  console.log(`[sync-instagram] Wrote ${OUTPUT_FILE}`);
  console.log(
    "[sync-instagram] Run npm run knowledge:setup to refresh the vector store."
  );
}

main().catch((err) => {
  console.error("[sync-instagram] Error:", err);
  process.exit(1);
});

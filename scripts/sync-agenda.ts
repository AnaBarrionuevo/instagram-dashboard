/**
 * Fetches the weekly agenda from felizarcoiris.com and writes knowledge/agenda-semana.txt.
 * Run `npm run knowledge:setup` afterward to upload the updated file to the vector store.
 *
 * Env (optional):
 *   AGENDA_SEMANA_API_URL — defaults to https://felizarcoiris.com/api/agenda/semana
 */

import fs from "fs";
import path from "path";
import { buildAgendaSemanaContent } from "../app/lib/knowledge/agenda-semana";
import { loadEnvLocal } from "./lib/load-env";

loadEnvLocal();

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const OUTPUT_FILE = path.join(KNOWLEDGE_DIR, "agenda-semana.txt");

async function main() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  console.log("[sync-agenda] Fetching weekly agenda...");

  const { content, cicloCount, eventoCount } = await buildAgendaSemanaContent();

  console.log(
    `[sync-agenda] ${cicloCount} ciclo(s), ${eventoCount} evento(s) especial(es)`
  );

  fs.writeFileSync(OUTPUT_FILE, content, "utf8");

  console.log(`[sync-agenda] Wrote ${OUTPUT_FILE}`);
  console.log(
    "[sync-agenda] Run npm run knowledge:setup to refresh the vector store."
  );
}

main().catch((err) => {
  console.error("[sync-agenda] Error:", err);
  process.exit(1);
});

/**
 * Creates or refreshes an OpenAI vector store from files in /knowledge.
 *
 * - First run (no OPENAI_VECTOR_STORE_ID): creates a store and prints the ID.
 * - Later runs: replaces all files in the existing store (use after sync-instagram).
 *
 * Usage: npm run knowledge:setup
 */

import fs from "fs";
import path from "path";
import {
  createVectorStore,
  refreshVectorStore,
} from "../app/lib/knowledge/vector-store";
import { loadEnvLocal } from "./lib/load-env";

loadEnvLocal();

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

function hasKnowledgeFiles(): boolean {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return false;

  return fs
    .readdirSync(KNOWLEDGE_DIR)
    .some((f) => !f.startsWith(".") && !f.endsWith(".md"));
}

async function main() {
  if (!hasKnowledgeFiles()) {
    console.warn(
      "[setup] No files in /knowledge — add documents or run npm run knowledge:sync-instagram"
    );
  }

  if (vectorStoreId) {
    console.log(`[setup] Refreshing vector store ${vectorStoreId}...`);
    const { uploadedFiles } = await refreshVectorStore(vectorStoreId);

    console.log("\n✅ Vector store refreshed.");
    console.log(`   OPENAI_VECTOR_STORE_ID=${vectorStoreId}`);
    console.log(`   Files: ${uploadedFiles.join(", ") || "(none)"}`);
    console.log(
      `\nProcessing may take a minute: https://platform.openai.com/storage/vector-stores/${vectorStoreId}`
    );
    return;
  }

  console.log("[setup] Creating new vector store...");
  const { vectorStoreId: newStoreId, uploadedFiles } =
    await createVectorStore();

  console.log("\n✅ Vector store created.");
  console.log(`   Vector Store ID: ${newStoreId}`);
  console.log(`   Files: ${uploadedFiles.join(", ") || "(none)"}`);
  console.log("\nAdd to .env.local:");
  console.log(`   OPENAI_VECTOR_STORE_ID=${newStoreId}`);
}

main().catch((err) => {
  console.error("[setup] Error:", err);
  process.exit(1);
});

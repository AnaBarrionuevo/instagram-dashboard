/**
 * Creates or refreshes an OpenAI vector store from files in /knowledge.
 *
 * - First run (no OPENAI_VECTOR_STORE_ID): creates a store and prints the ID.
 * - Later runs: replaces all files in the existing store (use after sync-instagram).
 *
 * Usage: npm run knowledge:setup
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { loadEnvLocal } from "./lib/load-env";

loadEnvLocal();

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_API_KEY in .env.local");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;

function listKnowledgeFiles(): string[] {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return [];
  }

  return fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => !f.startsWith(".") && !f.endsWith(".md"));
}

async function uploadKnowledgeFiles(): Promise<string[]> {
  const files = listKnowledgeFiles();

  if (files.length === 0) {
    console.warn(
      "[setup] No files in /knowledge — add documents or run npm run knowledge:sync-instagram"
    );
    return [];
  }

  console.log(`[setup] Uploading ${files.length} file(s)...`);
  const fileIds: string[] = [];

  for (const filename of files) {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    const uploaded = await openai.files.create({
      file: fs.createReadStream(filePath),
      purpose: "assistants",
    });
    console.log(`  ✓ ${filename} → ${uploaded.id}`);
    fileIds.push(uploaded.id);
  }

  return fileIds;
}

async function clearVectorStore(storeId: string): Promise<void> {
  console.log(`[setup] Clearing existing files from ${storeId}...`);

  const existing = await openai.vectorStores.files.list(storeId);

  for (const file of existing.data) {
    await openai.vectorStores.files.delete(file.id, {
      vector_store_id: storeId,
    });
    console.log(`  − removed ${file.id}`);
  }
}

async function attachFilesToStore(
  storeId: string,
  fileIds: string[]
): Promise<void> {
  for (const fileId of fileIds) {
    await openai.vectorStores.files.create(storeId, { file_id: fileId });
  }
}

async function main() {
  const fileIds = await uploadKnowledgeFiles();

  if (vectorStoreId) {
    console.log(`[setup] Refreshing vector store ${vectorStoreId}...`);
    await clearVectorStore(vectorStoreId);

    if (fileIds.length > 0) {
      await attachFilesToStore(vectorStoreId, fileIds);
    }

    console.log("\n✅ Vector store refreshed.");
    console.log(`   OPENAI_VECTOR_STORE_ID=${vectorStoreId}`);
    console.log(
      `\nProcessing may take a minute: https://platform.openai.com/storage/vector-stores/${vectorStoreId}`
    );
    return;
  }

  console.log("[setup] Creating new vector store...");

  const vectorStore = await openai.vectorStores.create({
    name: "Instagram DM Knowledge Base",
    ...(fileIds.length > 0 && { file_ids: fileIds }),
  });

  console.log("\n✅ Vector store created.");
  console.log(`   Vector Store ID: ${vectorStore.id}`);
  console.log("\nAdd to .env.local:");
  console.log(`   OPENAI_VECTOR_STORE_ID=${vectorStore.id}`);
}

main().catch((err) => {
  console.error("[setup] Error:", err);
  process.exit(1);
});

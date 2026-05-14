/**
 * One-time setup script: creates (or updates) an OpenAI Assistant with
 * file_search enabled and uploads every file in the /knowledge directory.
 *
 * Usage:
 *   npx tsx scripts/setup-assistant.ts
 *
 * On first run it prints the Assistant ID — copy it into .env.local as
 * OPENAI_ASSISTANT_ID. Re-running the script will replace the vector store
 * files with the latest versions from /knowledge.
 */

import OpenAI from "openai";
import fs from "fs";
import path from "path";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Missing OPENAI_ASSISTANT_ID env var. Run with: OPENAI_API_KEY=sk-... npx tsx scripts/setup-assistant.ts");
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

async function uploadKnowledgeFiles(): Promise<string[]> {
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => !f.startsWith("."));

  if (files.length === 0) {
    console.warn(
      `[setup] No files found in /knowledge — add .txt, .pdf, or .docx files there first.`
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

async function main() {
  const fileIds = await uploadKnowledgeFiles();

  if (ASSISTANT_ID) {
    // --- Update existing assistant ---
    console.log(`[setup] Updating existing assistant: ${ASSISTANT_ID}`);

    // Create a fresh vector store with the new files
    const vectorStore = await openai.beta.vectorStores.create({
      name: "Instagram DM Knowledge Base",
      ...(fileIds.length > 0 && { file_ids: fileIds }),
    });

    await openai.beta.assistants.update(ASSISTANT_ID, {
      tool_resources: {
        file_search: { vector_store_ids: [vectorStore.id] },
      },
    });

    console.log(`[setup] Assistant updated. Vector store: ${vectorStore.id}`);
  } else {
    // --- Create new assistant ---
    console.log("[setup] Creating new assistant...");

    const createParams: OpenAI.Beta.AssistantCreateParams = {
      name: "Instagram DM Assistant",
      model: "gpt-4o-mini",
      instructions:
        "You are a helpful Instagram DM assistant. Answer using the knowledge base provided. Be friendly, respond in 2–3 complete sentences, and never cut off mid-thought. If the answer isn't in your knowledge base, say so politely.",
      tools: [{ type: "file_search" }],
    };

    if (fileIds.length > 0) {
      const vectorStore = await openai.beta.vectorStores.create({
        name: "Instagram DM Knowledge Base",
        file_ids: fileIds,
      });
      createParams.tool_resources = {
        file_search: { vector_store_ids: [vectorStore.id] },
      };
      console.log(`[setup] Vector store created: ${vectorStore.id}`);
    }

    const assistant = await openai.beta.assistants.create(createParams);

    console.log("\n✅ Assistant created successfully!");
    console.log(`   Assistant ID: ${assistant.id}`);
    console.log("\nAdd this to your .env.local:");
    console.log(`   OPENAI_ASSISTANT_ID=${assistant.id}`);
  }
}

main().catch((err) => {
  console.error("[setup] Error:", err);
  process.exit(1);
});

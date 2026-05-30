import fs from "fs";
import os from "os";
import path from "path";
import OpenAI from "openai";

const KNOWLEDGE_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "knowledge"
);

export interface KnowledgeUpload {
  filename: string;
  /** Disk path — used when content is not provided. */
  path?: string;
  /** In-memory body — written to a temp file before upload. */
  content?: string;
}

function listDiskKnowledgeFiles(excludeFilenames: Set<string>): KnowledgeUpload[] {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return [];
  }

  return fs
    .readdirSync(KNOWLEDGE_DIR)
    .filter((f) => !f.startsWith(".") && !f.endsWith(".md"))
    .filter((f) => !excludeFilenames.has(f))
    .map((filename) => ({
      filename,
      path: path.join(KNOWLEDGE_DIR, filename),
    }));
}

function collectKnowledgeUploads(
  overrides: KnowledgeUpload[] = []
): KnowledgeUpload[] {
  const overrideNames = new Set(overrides.map((f) => f.filename));
  return [...listDiskKnowledgeFiles(overrideNames), ...overrides];
}

async function uploadKnowledgeFile(
  openai: OpenAI,
  file: KnowledgeUpload
): Promise<string> {
  let uploadPath: string;
  let cleanup = false;

  if (file.content !== undefined) {
    uploadPath = path.join(
      os.tmpdir(),
      `knowledge-${Date.now()}-${file.filename}`
    );
    fs.writeFileSync(uploadPath, file.content, "utf8");
    cleanup = true;
  } else if (file.path) {
    uploadPath = file.path;
  } else {
    throw new Error(`No content or path for ${file.filename}`);
  }

  try {
    const uploaded = await openai.files.create({
      file: fs.createReadStream(uploadPath),
      purpose: "assistants",
    });
    return uploaded.id;
  } finally {
    if (cleanup) {
      fs.unlinkSync(uploadPath);
    }
  }
}

async function clearVectorStore(
  openai: OpenAI,
  storeId: string
): Promise<void> {
  const existing = await openai.vectorStores.files.list(storeId);

  for (const file of existing.data) {
    await openai.vectorStores.files.delete(file.id, {
      vector_store_id: storeId,
    });
  }
}

async function attachFilesToStore(
  openai: OpenAI,
  storeId: string,
  fileIds: string[]
): Promise<void> {
  for (const fileId of fileIds) {
    await openai.vectorStores.files.create(storeId, { file_id: fileId });
  }
}

export interface RefreshVectorStoreResult {
  vectorStoreId: string;
  uploadedFiles: string[];
}

export async function refreshVectorStore(
  vectorStoreId: string,
  overrides: KnowledgeUpload[] = [],
  openaiClient?: OpenAI
): Promise<RefreshVectorStoreResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = openaiClient ?? new OpenAI({ apiKey });
  const uploads = collectKnowledgeUploads(overrides);

  if (uploads.length === 0) {
    throw new Error(
      "No knowledge files to upload — add documents to /knowledge or sync Instagram first"
    );
  }

  const fileIds: string[] = [];
  const uploadedFiles: string[] = [];

  for (const upload of uploads) {
    const fileId = await uploadKnowledgeFile(openai, upload);
    fileIds.push(fileId);
    uploadedFiles.push(upload.filename);
  }

  await clearVectorStore(openai, vectorStoreId);

  if (fileIds.length > 0) {
    await attachFilesToStore(openai, vectorStoreId, fileIds);
  }

  return { vectorStoreId, uploadedFiles };
}

export async function createVectorStore(
  overrides: KnowledgeUpload[] = [],
  openaiClient?: OpenAI
): Promise<RefreshVectorStoreResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = openaiClient ?? new OpenAI({ apiKey });
  const uploads = collectKnowledgeUploads(overrides);

  const fileIds: string[] = [];
  const uploadedFiles: string[] = [];

  for (const upload of uploads) {
    const fileId = await uploadKnowledgeFile(openai, upload);
    fileIds.push(fileId);
    uploadedFiles.push(upload.filename);
  }

  const vectorStore = await openai.vectorStores.create({
    name: "Instagram DM Knowledge Base",
    ...(fileIds.length > 0 && { file_ids: fileIds }),
  });

  return { vectorStoreId: vectorStore.id, uploadedFiles };
}

import {
  buildInstagramAgendaContent,
  instagramFeedConfigFromEnv,
  mergeInstagramTokens,
} from "@/app/lib/knowledge/instagram-feed";
import { buildAgendaSemanaContent } from "@/app/lib/knowledge/agenda-semana";
import { refreshVectorStore, type KnowledgeUpload } from "@/app/lib/knowledge/vector-store";
import { getTokenStoreState } from "@/app/lib/token-store";

export interface KnowledgeRefreshResult {
  vectorStoreId: string;
  postCount: number;
  accountId: string;
  cicloCount: number;
  eventoCount: number;
  uploadedFiles: string[];
}

export async function refreshKnowledgeBase(): Promise<KnowledgeRefreshResult> {
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID;
  if (!vectorStoreId) {
    throw new Error(
      "Missing OPENAI_VECTOR_STORE_ID — run npm run knowledge:setup first"
    );
  }

  const feedConfigFromEnv = instagramFeedConfigFromEnv();
  const stored = await getTokenStoreState();
  const feedConfig = mergeInstagramTokens(feedConfigFromEnv, {
    instagramToken: stored?.instagramToken,
    pageAccessToken: stored?.pageAccessToken,
  });

  const [instagramResult, agendaResult] = await Promise.allSettled([
    buildInstagramAgendaContent(feedConfig),
    buildAgendaSemanaContent(),
  ]);

  if (agendaResult.status === "rejected") {
    throw agendaResult.reason;
  }

  const overrides: KnowledgeUpload[] = [
    {
      filename: "agenda-semana.txt",
      content: agendaResult.value.content,
    },
  ];

  let postCount = 0;
  let accountId = feedConfig.accountId;

  if (instagramResult.status === "fulfilled") {
    overrides.push({
      filename: "instagram-agenda.txt",
      content: instagramResult.value.content,
    });
    postCount = instagramResult.value.postCount;
    accountId = instagramResult.value.accountId;
  } else {
    const message =
      instagramResult.reason instanceof Error
        ? instagramResult.reason.message
        : String(instagramResult.reason);
    console.warn(
      "[knowledge/refresh] Instagram sync skipped:",
      message
    );
  }

  const { uploadedFiles } = await refreshVectorStore(vectorStoreId, overrides);

  return {
    vectorStoreId,
    postCount,
    accountId,
    cicloCount: agendaResult.value.cicloCount,
    eventoCount: agendaResult.value.eventoCount,
    uploadedFiles,
  };
}

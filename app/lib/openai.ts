import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory thread store: maps Instagram sender ID → OpenAI thread ID.
// Threads persist for the lifetime of the server process, giving the assistant
// conversation memory. They reset on redeploy — upgrade to a DB if you need
// cross-deploy persistence.
const threadMap = new Map<string, string>();

async function getOrCreateThread(senderId: string): Promise<string> {
  const existing = threadMap.get(senderId);
  if (existing) return existing;

  const thread = await openai.beta.threads.create();
  threadMap.set(senderId, thread.id);
  return thread.id;
}

export async function generateAIResponse(
  userMessage: string,
  senderId: string
): Promise<string | null> {
  const assistantId = process.env.OPENAI_ASSISTANT_ID;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[OpenAI] Missing OPENAI_API_KEY");
    return null;
  }

  if (!assistantId) {
    console.error(
      "[OpenAI] Missing OPENAI_ASSISTANT_ID — run scripts/setup-assistant.ts first"
    );
    return null;
  }

  try {
    const threadId = await getOrCreateThread(senderId);

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
    });

    if (run.status !== "completed") {
      console.error("[OpenAI] Run did not complete:", run.status, run.last_error);
      return null;
    }

    const messages = await openai.beta.threads.messages.list(threadId, {
      order: "desc",
      limit: 1,
    });

    const latest = messages.data[0];
    if (!latest || latest.role !== "assistant") return null;

    const textBlock = latest.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    // Strip citation annotations like 【4:0†source】
    const text = textBlock.text.value.replace(/【[^】]*】/g, "").trim();

    console.log("[OpenAI] Generated response:", text);
    return text;
  } catch (error) {
    console.error("[OpenAI] Error:", error);
    return null;
  }
}

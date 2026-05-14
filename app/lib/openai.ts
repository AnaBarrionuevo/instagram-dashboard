export async function generateAIResponse(userMessage: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("[OpenAI] Missing OPENAI_API_KEY");
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful Instagram DM assistant. Keep responses concise (under 280 characters) and friendly. Respond directly to the user's message.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        max_tokens: 100,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[OpenAI] API error:", data);
      return null;
    }

    const aiMessage =
      data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    console.log("[OpenAI] Generated response:", aiMessage);
    return aiMessage;
  } catch (error) {
    console.error("[OpenAI] Error:", error);
    return null;
  }
}

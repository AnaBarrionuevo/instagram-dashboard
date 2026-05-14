import { NextRequest, NextResponse } from "next/server";

// Meta sends a GET request to verify the webhook on first setup
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log("[Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[Webhook] Verification failed — token mismatch");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Meta sends a POST request for each new event (DMs, reactions, etc.)
export async function POST(req: NextRequest) {
  const body = await req.json();

  console.log("[Webhook] Event received:", JSON.stringify(body, null, 2));

  // Guard: only handle Instagram messaging events
  if (body.object !== "instagram") {
    return NextResponse.json({ error: "Unrecognized object" }, { status: 400 });
  }

  const entries: MetaEntry[] = body.entry ?? [];

  for (const entry of entries) {
    // Handle format 1: changes array (test webhooks)
    const changes: MetaChange[] = entry.changes ?? [];
    for (const change of changes) {
      if (change.field !== "messages") {
        continue;
      }

      const value = change.value;
      await processMessage(value);
    }

    // Handle format 2: messaging array (real messages)
    const messagingEvents: MetaMessagingEvent[] = entry.messaging ?? [];
    for (const event of messagingEvents) {
      await processMessage(event);
    }
  }

  // Always return 200 quickly — Meta will retry if you don't
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// Process a message event (handles both webhook formats)
async function processMessage(event: any): Promise<void> {
  if (event.message) {
    const messageText = event.message.text ?? "(non-text message)";

    console.log("[Webhook] New DM:", {
      from: event.sender.id,
      text: messageText,
      timestamp: new Date(
        typeof event.timestamp === "string"
          ? parseInt(event.timestamp) * 1000
          : event.timestamp
      ).toISOString(),
    });

    // Generate AI response using OpenAI
    const aiResponse = await generateAIResponse(messageText);

    if (aiResponse) {
      console.log("[Webhook] Sending AI response to:", event.sender.id);
      await sendInstagramMessage(event.sender.id, aiResponse);
    } else {
      console.error("[Webhook] Failed to generate AI response");
      await sendInstagramMessage(
        event.sender.id,
        "Sorry, I couldn't process your message at the moment."
      );
    }
  }

  if (event.read) {
    console.log("[Webhook] Message read by:", event.sender.id);
  }

  if (event.reaction) {
    console.log("[Webhook] Reaction:", {
      from: event.sender.id,
      emoji: event.reaction.emoji,
      action: event.reaction.action,
    });
  }
}

// Get the conversation ID for a sender-recipient pair
async function getConversationId(
  senderId: string,
  recipientId: string
): Promise<string | null> {
  const accessToken = process.env.INSTAGRAM_TOKEN;
  const businessAccountId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken || !businessAccountId) {
    console.error("[GetConversation] Missing credentials");
    return null;
  }

  try {
    const url = `https://graph.instagram.com/v18.0/${businessAccountId}/conversations?fields=id,senders&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error("[GetConversation] Failed to fetch conversations:", data);
      return null;
    }

    // Find the conversation with this sender
    const conversations = data.data ?? [];
    const conversation = conversations.find((conv: any) =>
      conv.senders?.some((sender: any) => sender.id === senderId)
    );

    if (conversation) {
      console.log("[GetConversation] Found conversation:", conversation.id);
      return conversation.id;
    }

    console.warn(
      "[GetConversation] No conversation found for sender:",
      senderId
    );
    return null;
  } catch (error) {
    console.error("[GetConversation] Error:", error);
    return null;
  }
}

// Generate AI response using OpenAI API
async function generateAIResponse(userMessage: string): Promise<string | null> {
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

// Function to send a DM via Instagram Graph API
async function sendInstagramMessage(
  recipientId: string,
  message: string
): Promise<void> {
  const accessToken = process.env.INSTAGRAM_TOKEN;

  if (!accessToken) {
    console.error("[SendMessage] Missing INSTAGRAM_TOKEN");
    return;
  }

  const url = `https://graph.instagram.com/v25.0/me/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: { text: message },
        recipient: { id: recipientId },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[SendMessage] Failed to send message:", data);
      return;
    }

    console.log("[SendMessage] Message sent successfully:", data);
  } catch (error) {
    console.error("[SendMessage] Error:", error);
  }
}

// --- Types ---

interface MetaEntry {
  id: string;
  time: number;
  changes?: MetaChange[];
  messaging?: MetaMessagingEvent[];
}

interface MetaChange {
  field: string;
  value: {
    sender: { id: string };
    recipient?: { id: string };
    timestamp: string;
    message?: {
      mid: string;
      text?: string;
    };
    read?: {
      watermark: number;
    };
    reaction?: {
      mid: string;
      action: "react" | "unreact";
      emoji?: string;
    };
  };
}

interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
  };
  read?: {
    watermark: number;
  };
  reaction?: {
    mid: string;
    action: "react" | "unreact";
    emoji?: string;
  };
}

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
    const changes: MetaChange[] = entry.changes ?? [];

    for (const change of changes) {
      // Only process message field changes
      if (change.field !== "messages") {
        continue;
      }

      const value = change.value;

      if (value.message) {
        console.log("[Webhook] New DM:", {
          from: value.sender.id,
          text: value.message.text ?? "(non-text message)",
          timestamp: new Date(parseInt(value.timestamp) * 1000).toISOString(),
        });

        // Send a "Hello world" reply to this message
        await sendInstagramMessage(
          value.sender.id, // sender ID for the reply
          "Hello world"
        );
      }

      if (value.read) {
        console.log("[Webhook] Message read by:", value.sender.id);
      }

      if (value.reaction) {
        console.log("[Webhook] Reaction:", {
          from: value.sender.id,
          emoji: value.reaction.emoji,
          action: value.reaction.action,
        });
      }
    }
  }

  // Always return 200 quickly — Meta will retry if you don't
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

// Function to send a DM via Instagram Graph API
async function sendInstagramMessage(
  conversationId: string,
  message: string
): Promise<void> {
  const accessToken = process.env.INSTAGRAM_TOKEN;

  if (!accessToken) {
    console.error("[SendMessage] Missing INSTAGRAM_TOKEN");
    return;
  }

  const url = `https://graph.instagram.com/v18.0/${conversationId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: conversationId },
        message: { text: message },
        access_token: accessToken,
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

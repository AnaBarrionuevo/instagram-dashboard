import { generateAIResponse } from "@/app/lib/openai";
import { sendInstagramMessage } from "@/app/lib/instagram";

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

export async function processWebhookEvent(
  entries: MetaEntry[]
): Promise<void> {
  for (const entry of entries) {
    // Handle format 1: changes array (test webhooks)
    const changes: MetaChange[] = entry.changes ?? [];
    for (const change of changes) {
      if (change.field !== "messages") {
        continue;
      }

      await processMessage(change.value);
    }

    // Handle format 2: messaging array (real messages)
    const messagingEvents: MetaMessagingEvent[] = entry.messaging ?? [];
    for (const event of messagingEvents) {
      await processMessage(event);
    }
  }
}

async function processMessage(event: any): Promise<void> {
  // Only process incoming messages, ignore read receipts and reactions
  if (!event.message) {
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

    return; // Exit early for non-message events
  }

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
    const success = await sendInstagramMessage(event.sender.id, aiResponse);

    if (!success) {
      console.error("[Webhook] Failed to send response message");
    }
  } else {
    console.error("[Webhook] Failed to generate AI response");
    await sendInstagramMessage(
      event.sender.id,
      "Sorry, I couldn't process your message at the moment."
    );
  }
}

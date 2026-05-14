import { NextRequest, NextResponse } from "next/server";
import { processWebhookEvent } from "@/app/services/webhook.service";

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

  const entries = body.entry ?? [];
  await processWebhookEvent(entries);

  // Always return 200 quickly — Meta will retry if you don't
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

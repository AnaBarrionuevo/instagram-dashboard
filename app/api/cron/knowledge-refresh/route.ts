import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/app/lib/cron-auth";
import { refreshKnowledgeBase } from "@/app/lib/knowledge/refresh";
import { refreshMetaTokensToStore } from "@/app/lib/meta/token-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    // Best-effort: refresh tokens first (requires they are still valid).
    // Persist refreshed tokens to KV so we don't rely on Vercel env updates.
    try {
      const tokenResult = await refreshMetaTokensToStore();
      if (tokenResult.refreshed) {
        console.log("[cron/knowledge-refresh] Meta tokens refreshed and stored.");
      } else {
        console.log("[cron/knowledge-refresh] Meta token refresh skipped (missing config).");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[cron/knowledge-refresh] Token refresh failed:", msg);
    }

    const result = await refreshKnowledgeBase();

    console.log(
      `[cron/knowledge-refresh] Agenda: ${result.cicloCount} ciclo(s), ${result.eventoCount} evento(s)`
    );
    console.log(
      `[cron/knowledge-refresh] Synced ${result.postCount} post(s) for account ${result.accountId}`
    );
    console.log(
      `[cron/knowledge-refresh] Refreshed vector store ${result.vectorStoreId} (${result.uploadedFiles.length} file(s))`
    );

    return NextResponse.json({
      ok: true,
      cicloCount: result.cicloCount,
      eventoCount: result.eventoCount,
      postCount: result.postCount,
      accountId: result.accountId,
      vectorStoreId: result.vectorStoreId,
      uploadedFiles: result.uploadedFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/knowledge-refresh] Error:", message);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

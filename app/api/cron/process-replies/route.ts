import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { processConversation } from "@/lib/ai/setter";

// Called by Vercel Cron every minute.
// Picks up pending_ai_replies whose process_after <= NOW() and processes them.
export async function GET(req: NextRequest) {
  // Verify cron secret so random visitors can't trigger it
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Claim up to 10 due pending replies atomically
  const { data: rows, error } = await admin
    .from("pending_ai_replies")
    .select("id, conversation_id")
    .eq("status", "pending")
    .lte("process_after", new Date().toISOString())
    .order("process_after", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[cron] fetch pending replies error", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const results = await Promise.allSettled(
    (rows as { id: string; conversation_id: string }[]).map(async (row) => {
      // Mark as processing
      await admin
        .from("pending_ai_replies")
        .update({ status: "processing" })
        .eq("id", row.id);

      try {
        const result = await processConversation(row.conversation_id);

        await admin
          .from("pending_ai_replies")
          .update({ status: "done" })
          .eq("id", row.id);

        return result;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[cron] processConversation error", row.conversation_id, errMsg);

        await admin
          .from("pending_ai_replies")
          .update({ status: "failed", error: errMsg })
          .eq("id", row.id);

        throw err;
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ processed: rows.length, succeeded, failed });
}

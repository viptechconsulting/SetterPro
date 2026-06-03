import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/unipile";
import type { UnipileWebhookPayload } from "@/types/unipile";

// Random delay between 30 seconds and 5 minutes
function randomDelayMs(): number {
  return Math.floor(Math.random() * (5 * 60 * 1000 - 30 * 1000) + 30 * 1000);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Verify signature if secret is set
  const sig = req.headers.get("x-unipile-signature") ?? "";
  if (sig) {
    const valid = await verifyWebhookSignature(rawBody, sig);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: UnipileWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as UnipileWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle new inbound messages
  if (payload.event !== "messaging.new_message") {
    return NextResponse.json({ ok: true });
  }

  const data = payload.data ?? {};
  const chatId = data.chat_id as string | undefined;
  const senderId = data.sender_id as string | undefined;
  const accountId = payload.account_id;
  const isSender = (data.is_sender as boolean | undefined) ?? false;

  // Ignore messages sent by us
  if (isSender || !chatId || !senderId) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  // Find the linkedin_account in our DB to get workspace_id
  const { data: liAccount } = await admin
    .from("linkedin_accounts")
    .select("id, workspace_id")
    .eq("unipile_account_id", accountId)
    .single();

  if (!liAccount) {
    // Account not registered in our system
    return NextResponse.json({ ok: true });
  }

  const la = liAccount as { id: string; workspace_id: string };

  // Upsert conversation
  const { data: convData, error: convErr } = await admin
    .from("conversations")
    .upsert(
      {
        workspace_id: la.workspace_id,
        linkedin_account_id: la.id,
        unipile_chat_id: chatId,
        unipile_account_id: accountId,
        prospect_unipile_id: senderId,
        prospect_name: (data.sender_name as string | undefined) ?? null,
        prospect_headline: (data.sender_headline as string | undefined) ?? null,
      },
      { onConflict: "workspace_id,unipile_chat_id", ignoreDuplicates: false }
    )
    .select("id, ai_enabled, lead_status")
    .single();

  if (convErr || !convData) {
    console.error("[webhook] conversation upsert error", convErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const conv = convData as { id: string; ai_enabled: boolean; lead_status: string };

  // Skip if AI is disabled or lead already booked
  if (!conv.ai_enabled || conv.lead_status === "booked") {
    return NextResponse.json({ ok: true });
  }

  // Store inbound message
  await admin.from("messages").insert({
    conversation_id: conv.id,
    role: "user",
    content: (data.text as string | undefined) ?? "",
  });

  // Enqueue delayed reply
  const processAfter = new Date(Date.now() + randomDelayMs()).toISOString();
  await admin.from("pending_ai_replies").insert({
    conversation_id: conv.id,
    workspace_id: la.workspace_id,
    process_after: processAfter,
    status: "pending",
  });

  return NextResponse.json({ ok: true });
}

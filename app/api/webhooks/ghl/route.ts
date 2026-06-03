import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

interface GHLWebhookPayload {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  contactId?: string;
  calendarId?: string;
  appointmentId?: string;
  startTime?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  let payload: GHLWebhookPayload;
  try {
    payload = await req.json() as GHLWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = payload.email?.toLowerCase().trim();
  const name = [payload.firstName, payload.lastName].filter(Boolean).join(" ");

  if (!email) {
    // Log for debugging even without email
    console.log("[ghl webhook] no email in payload", JSON.stringify(payload));
    return NextResponse.json({ ok: true, warning: "no email" });
  }

  const admin = createAdminClient();

  // Find conversations where prospect email matches
  // We store prospect_name but not email directly — match by name or mark all active conversations
  // Best effort: mark any conversation with this prospect name as booked
  const { data: conversations } = await admin
    .from("conversations")
    .select("id, workspace_id, prospect_name")
    .eq("ai_enabled", true)
    .neq("lead_status", "booked");

  const convs = (conversations ?? []) as {
    id: string;
    workspace_id: string;
    prospect_name: string | null;
  }[];

  // Match by email stored in prospect data or by name (best effort)
  // Also try exact name match
  const matched = name
    ? convs.filter((c) =>
        c.prospect_name?.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes((c.prospect_name ?? "").toLowerCase())
      )
    : [];

  if (matched.length > 0) {
    // Mark all matched conversations as booked and disable AI
    await Promise.all(
      matched.map((c) =>
        admin
          .from("conversations")
          .update({ lead_status: "booked", ai_enabled: false })
          .eq("id", c.id)
      )
    );

    console.log(`[ghl webhook] marked ${matched.length} conversation(s) as booked for "${name}" (${email})`);
  } else {
    console.log(`[ghl webhook] no matching conversation found for "${name}" (${email})`);
  }

  return NextResponse.json({ ok: true, matched: matched.length });
}

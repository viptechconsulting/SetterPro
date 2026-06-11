import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendInvitation, sendMessage, getOrCreateChat } from "@/lib/unipile";
import { personalizeTemplate } from "@/lib/campaigns/personalize";
import type { CampaignLead } from "@/types/campaign";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // ── 1. Process due invitations ────────────────────────────────────────────
  const { data: dueLeads } = await admin
    .from("campaign_leads")
    .select("*, campaigns!inner(status, invite_note_template, daily_cap, campaign_linkedin_accounts(linkedin_account_id, linkedin_accounts(unipile_account_id, status)))")
    .eq("status", "queued")
    .lte("scheduled_at", now)
    .limit(20);

  let invitesSent = 0;
  let inviteErrors = 0;

  for (const rawLead of (dueLeads ?? [])) {
    const lead = rawLead as CampaignLead & {
      campaigns: {
        status: string;
        invite_note_template: string | null;
        daily_cap: number;
        campaign_linkedin_accounts: Array<{
          linkedin_account_id: string;
          linkedin_accounts: { unipile_account_id: string; status: string } | null;
        }>;
      };
    };

    if (lead.campaigns.status !== "active") continue;

    // Pick an active account from the pool that hasn't hit daily cap
    const today = new Date().toISOString().slice(0, 10);
    let pickedAccountId: string | null = null;
    let pickedUnipileAccountId: string | null = null;

    for (const acct of lead.campaigns.campaign_linkedin_accounts) {
      if (!acct.linkedin_accounts || acct.linkedin_accounts.status !== "active") continue;

      // Count today's invites for this account
      const { count } = await admin
        .from("campaign_leads")
        .select("id", { count: "exact", head: true })
        .eq("linkedin_account_id", acct.linkedin_account_id)
        .eq("status", "invite_sent")
        .gte("invited_at", `${today}T00:00:00Z`);

      if ((count ?? 0) < lead.campaigns.daily_cap) {
        pickedAccountId = acct.linkedin_account_id;
        pickedUnipileAccountId = acct.linkedin_accounts.unipile_account_id;
        break;
      }
    }

    if (!pickedAccountId || !pickedUnipileAccountId) continue;

    // Build personalized note
    const note = lead.campaigns.invite_note_template
      ? personalizeTemplate(lead.campaigns.invite_note_template, {
          first_name: lead.prospect_name?.split(" ")[0],
          last_name: lead.prospect_name?.split(" ").slice(1).join(" "),
          company_name: lead.prospect_company ?? undefined,
          headline: lead.prospect_headline ?? undefined,
        })
      : undefined;

    try {
      await sendInvitation(pickedUnipileAccountId, lead.prospect_unipile_id, note);

      await admin.from("campaign_leads").update({
        status: "invite_sent",
        linkedin_account_id: pickedAccountId,
        invited_at: now,
        error: null,
      }).eq("id", lead.id);

      // Increment campaign counter
      // Increment invited_count best-effort
      try {
        const { data: cur } = await admin.from("campaigns").select("invited_count").eq("id", lead.campaign_id).single();
        if (cur) {
          await admin.from("campaigns").update({ invited_count: (cur as { invited_count: number }).invited_count + 1 }).eq("id", lead.campaign_id);
        }
      } catch { /* ignore */ }

      invitesSent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const status = (err as Error & { status?: number }).status;

      if (status === 429 || status === 422) {
        // Rate limited — reschedule with backoff
        const retryIn = 30 + lead.retry_count * 15; // 30, 45, 60... min
        const retryAt = new Date(Date.now() + retryIn * 60 * 1000).toISOString();
        await admin.from("campaign_leads").update({
          scheduled_at: retryAt,
          retry_count: lead.retry_count + 1,
          error: errMsg,
        }).eq("id", lead.id);
      } else {
        await admin.from("campaign_leads").update({
          status: "error",
          error: errMsg,
        }).eq("id", lead.id);
        inviteErrors++;
      }
    }
  }

  // ── 2. Process due first messages (post-connection) ───────────────────────
  const { data: connectedLeads } = await admin
    .from("campaign_leads")
    .select("*, campaigns!inner(first_message_template, status), linkedin_accounts(unipile_account_id)")
    .eq("status", "connected")
    .lte("first_message_scheduled_at", now)
    .not("first_message_scheduled_at", "is", null)
    .limit(20);

  let messagesSent = 0;

  for (const rawLead of (connectedLeads ?? [])) {
    const lead = rawLead as CampaignLead & {
      campaigns: { first_message_template: string; status: string };
      linkedin_accounts: { unipile_account_id: string } | null;
    };

    if (lead.campaigns.status !== "active") continue;

    const unipileAccountId = lead.linkedin_accounts?.unipile_account_id;
    if (!unipileAccountId || !lead.prospect_unipile_id) continue;

    const message = personalizeTemplate(lead.campaigns.first_message_template, {
      first_name: lead.prospect_name?.split(" ")[0],
      last_name: lead.prospect_name?.split(" ").slice(1).join(" "),
      company_name: lead.prospect_company ?? undefined,
      headline: lead.prospect_headline ?? undefined,
    });

    try {
      const chatId = await getOrCreateChat(unipileAccountId, lead.prospect_unipile_id);
      await sendMessage(unipileAccountId, chatId, message);
      await admin.from("campaign_leads").update({
        status: "first_message_sent",
        first_message_sent_at: now,
        unipile_chat_id: chatId,
      }).eq("id", lead.id);
      messagesSent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[cron campaigns] first message error", lead.id, errMsg);
    }
  }

  return NextResponse.json({ invitesSent, inviteErrors, messagesSent });
}

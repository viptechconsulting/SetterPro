import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { generateScheduledTimes } from "@/lib/campaigns/scheduler";
import type { MembershipRow } from "@/types/database";
import type { CampaignCreatePayload } from "@/types/campaign";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: rawM } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
    const m = rawM as Pick<MembershipRow, "workspace_id"> | null;
    if (!m) return NextResponse.json({ error: "Sin workspace" }, { status: 404 });

    const { data: campaigns } = await supabase
      .from("campaigns").select("*")
      .eq("workspace_id", m.workspace_id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ campaigns: campaigns ?? [] });
  } catch (err) {
    console.error("[campaigns GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: rawM } = await supabase
      .from("workspace_members").select("workspace_id, role").eq("user_id", user.id).single();
    const m = rawM as MembershipRow | null;
    if (!m) return NextResponse.json({ error: "Sin workspace" }, { status: 404 });
    if (!["owner", "admin"].includes(m.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await req.json() as CampaignCreatePayload;
    const admin = createAdminClient();

    // Create campaign
    const { data: rawCampaign, error: campaignErr } = await admin
      .from("campaigns")
      .insert({
        workspace_id: m.workspace_id,
        setter_config_id: body.setter_config_id,
        brain_id: body.brain_id,
        name: body.name,
        status: "draft",
        search_url: body.search_url,
        search_params: body.search_params,
        invite_note_template: body.invite_note_template || null,
        first_message_template: body.first_message_template,
        daily_cap: body.daily_cap,
        time_window_start: body.time_window_start,
        time_window_end: body.time_window_end,
        total_leads: body.leads.length,
      })
      .select("id")
      .single();

    if (campaignErr || !rawCampaign) {
      return NextResponse.json({ error: "Error creando campaña" }, { status: 500 });
    }
    const campaign = rawCampaign as { id: string };

    // Generate scheduled times
    const times = generateScheduledTimes(
      body.leads.length,
      body.daily_cap,
      body.time_window_start,
      body.time_window_end
    );

    // Bulk insert leads
    const leadsToInsert = body.leads.map((lead, i) => ({
      campaign_id: campaign.id,
      workspace_id: m.workspace_id,
      prospect_unipile_id: lead.provider_id,
      prospect_name: [lead.first_name, lead.last_name].filter(Boolean).join(" ") || null,
      prospect_headline: lead.headline,
      prospect_company: lead.company_name,
      prospect_location: lead.location,
      prospect_profile_url: lead.profile_url,
      status: "queued" as const,
      scheduled_at: times[i]?.toISOString() ?? null,
    }));

    await admin.from("campaign_leads").insert(leadsToInsert);

    // Link LinkedIn accounts
    if (body.account_ids.length > 0) {
      await admin.from("campaign_linkedin_accounts").insert(
        body.account_ids.map((id) => ({ campaign_id: campaign.id, linkedin_account_id: id }))
      );
    }

    return NextResponse.json({ campaign_id: campaign.id });
  } catch (err) {
    console.error("[campaigns POST]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

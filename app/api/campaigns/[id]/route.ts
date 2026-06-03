import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import type { MembershipRow } from "@/types/database";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: campaign } = await supabase
    .from("campaigns").select("*").eq("id", id).single();
  if (!campaign) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const { data: leads } = await supabase
    .from("campaign_leads").select("*").eq("campaign_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ campaign, leads: leads ?? [] });
}

// PATCH /api/campaigns/[id] — activate / pause / update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: rawM } = await supabase
    .from("workspace_members").select("workspace_id, role").eq("user_id", user.id).single();
  const m = rawM as MembershipRow | null;
  if (!m || !["owner", "admin"].includes(m.role)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json() as { status?: string };
  const admin = createAdminClient();

  await admin.from("campaigns").update({ status: body.status }).eq("id", id);

  return NextResponse.json({ success: true });
}

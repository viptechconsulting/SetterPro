import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveSearchParameters, searchLinkedIn } from "@/lib/unipile";
import type { MembershipRow } from "@/types/database";

// GET /api/linkedin/search?url=... — resolve URL to params
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url requerida" }, { status: 400 });

  const { data: rawM } = await supabase
    .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
  const m = rawM as Pick<MembershipRow, "workspace_id"> | null;
  if (!m) return NextResponse.json({ error: "Sin workspace" }, { status: 404 });

  // Use first active LinkedIn account
  const { data: rawAccount } = await supabase
    .from("linkedin_accounts").select("unipile_account_id")
    .eq("workspace_id", m.workspace_id).eq("status", "active").limit(1).single();
  const account = rawAccount as { unipile_account_id: string } | null;
  if (!account) return NextResponse.json({ error: "No hay cuenta de LinkedIn activa" }, { status: 404 });

  try {
    const params = await resolveSearchParameters(account.unipile_account_id, url);
    return NextResponse.json({ params });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// POST /api/linkedin/search — run search
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { params, page = 1, count = 25 } = await req.json() as {
    params: Record<string, unknown>;
    page?: number;
    count?: number;
  };

  const { data: rawM } = await supabase
    .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
  const m = rawM as Pick<MembershipRow, "workspace_id"> | null;
  if (!m) return NextResponse.json({ error: "Sin workspace" }, { status: 404 });

  const { data: rawAccount } = await supabase
    .from("linkedin_accounts").select("unipile_account_id")
    .eq("workspace_id", m.workspace_id).eq("status", "active").limit(1).single();
  const account = rawAccount as { unipile_account_id: string } | null;
  if (!account) return NextResponse.json({ error: "No hay cuenta de LinkedIn activa" }, { status: 404 });

  try {
    const results = await searchLinkedIn(account.unipile_account_id, params, page, count);
    return NextResponse.json(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

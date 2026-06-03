import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { createReconnectUrl } from "@/lib/unipile";
import type { LinkedInAccount, MembershipRow } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { linkedin_account_id?: string };
    const { linkedin_account_id } = body;

    if (!linkedin_account_id) {
      return NextResponse.json({ error: "linkedin_account_id es requerido" }, { status: 400 });
    }

    const { data: rawAccount } = await supabase
      .from("linkedin_accounts")
      .select("unipile_account_id, workspace_id, status")
      .eq("id", linkedin_account_id)
      .single();

    const account = rawAccount as Pick<LinkedInAccount, "unipile_account_id" | "workspace_id" | "status"> | null;

    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    const { data: rawMembership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", account.workspace_id)
      .eq("user_id", user.id)
      .single();

    const membership = rawMembership as Pick<MembershipRow, "role"> | null;

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;

    const reconnectUrl = await createReconnectUrl({
      unipileAccountId: account.unipile_account_id,
      workspaceId: account.workspace_id,
      appUrl,
    });

    const admin = createAdminClient();
    await admin
      .from("linkedin_accounts")
      .update({ status: "reconnecting", reconnect_url: reconnectUrl } satisfies Partial<LinkedInAccount["Update"]>)
      .eq("id", linkedin_account_id);

    return NextResponse.json({ url: reconnectUrl });
  } catch (err) {
    console.error("[linkedin/reconnect]", err);
    return NextResponse.json({ error: "Error al generar URL de reconexión" }, { status: 500 });
  }
}

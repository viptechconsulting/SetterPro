import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import { getAccount, getAccountProfile } from "@/lib/unipile";
import type { MembershipRow, LinkedInAccount } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as {
      account_id?: string;
      workspace_id?: string;
      is_reconnect?: boolean;
    };
    const { account_id, workspace_id, is_reconnect } = body;

    if (!account_id || !workspace_id) {
      return NextResponse.json(
        { error: "account_id y workspace_id son requeridos" },
        { status: 400 }
      );
    }

    const { data: rawMembership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    const membership = rawMembership as Pick<MembershipRow, "role"> | null;

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const [accountResult, profileResult] = await Promise.allSettled([
      getAccount(account_id),
      getAccountProfile(account_id),
    ]);

    const accountData = accountResult.status === "fulfilled" ? accountResult.value : null;
    const profileData = profileResult.status === "fulfilled" ? profileResult.value : null;

    const admin = createAdminClient();

    if (is_reconnect) {
      const update: Partial<LinkedInAccount> = {
        status: "active",
        display_name: profileData?.display_name ?? accountData?.name ?? null,
        headline: profileData?.headline ?? null,
        avatar_url: profileData?.profile_picture_url ?? null,
        email: profileData?.email ?? accountData?.connection_params?.mail ?? null,
        disconnected_at: null,
        reconnect_url: null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await admin
        .from("linkedin_accounts")
        .update(update)
        .eq("unipile_account_id", account_id)
        .eq("workspace_id", workspace_id);

      if (updateError) {
        console.error("[linkedin/callback] update error:", updateError);
        return NextResponse.json({ error: "Error al actualizar la cuenta" }, { status: 500 });
      }
    } else {
      const insert: LinkedInAccount["Insert"] = {
        workspace_id,
        unipile_account_id: account_id,
        linkedin_urn: profileData?.id ?? null,
        display_name: profileData?.display_name ?? accountData?.name ?? null,
        headline: profileData?.headline ?? null,
        avatar_url: profileData?.profile_picture_url ?? null,
        email: profileData?.email ?? accountData?.connection_params?.mail ?? null,
        status: "active",
        connected_at: new Date().toISOString(),
      };

      const { error: insertError } = await admin
        .from("linkedin_accounts")
        .upsert(insert, { onConflict: "unipile_account_id" });

      if (insertError) {
        console.error("[linkedin/callback] insert error:", insertError);
        return NextResponse.json({ error: "Error al guardar la cuenta" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[linkedin/callback]", err);
    return NextResponse.json({ error: "Error interno al procesar la cuenta" }, { status: 500 });
  }
}

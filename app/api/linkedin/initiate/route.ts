import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createHostedAuthUrl } from "@/lib/unipile";
import type { MembershipRow } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as { workspace_id?: string };
    const { workspace_id } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: "workspace_id es requerido" }, { status: 400 });
    }

    const { data: rawMembership } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    const membership = rawMembership as Pick<MembershipRow, "role"> | null;

    if (!membership) {
      return NextResponse.json({ error: "No tenés acceso a este workspace" }, { status: 403 });
    }

    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Solo los owners y admins pueden conectar cuentas" },
        { status: 403 }
      );
    }

    if (!process.env.UNIPILE_API_KEY) {
      console.error("UNIPILE_API_KEY no está configurada");
      return NextResponse.json({ error: "Servicio no disponible" }, { status: 503 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`;

    const wizardUrl = await createHostedAuthUrl({ workspaceId: workspace_id, appUrl });

    return NextResponse.json({ url: wizardUrl });
  } catch (err) {
    console.error("[linkedin/initiate]", err);
    return NextResponse.json({ error: "Error al iniciar la conexión" }, { status: 500 });
  }
}

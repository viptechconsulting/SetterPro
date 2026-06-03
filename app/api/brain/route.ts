import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import type { MembershipRow } from "@/types/database";
import type { BrainData } from "@/types/brain";

// GET /api/brain — obtener el brain del workspace
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: rawM } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
    const membership = rawM as Pick<MembershipRow, "workspace_id"> | null;
    if (!membership) return NextResponse.json({ error: "Sin workspace" }, { status: 404 });

    const { data: brain } = await supabase
      .from("brains").select("*").eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: true }).limit(1).single();

    return NextResponse.json({ brain: brain ?? null });
  } catch (err) {
    console.error("[brain GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/brain — crear o actualizar el brain
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: rawM } = await supabase
      .from("workspace_members").select("workspace_id, role").eq("user_id", user.id).single();
    const membership = rawM as MembershipRow | null;
    if (!membership) return NextResponse.json({ error: "Sin workspace" }, { status: 404 });
    if (!["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await req.json() as BrainData;
    const admin = createAdminClient();

    // Verificar si ya existe
    const { data: existing } = await admin
      .from("brains").select("id").eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: true }).limit(1).single();

    if (existing) {
      await admin.from("brains").update({
        name: body.name,
        product_description: body.product_description,
        icp_description: body.icp_description,
        value_propositions: body.value_propositions,
        case_studies: body.case_studies,
        faqs: body.faqs,
        calendly_link: body.calendly_link,
        additional_context: body.additional_context,
      }).eq("id", existing.id);
    } else {
      await admin.from("brains").insert({
        workspace_id: membership.workspace_id,
        name: body.name || "Principal",
        product_description: body.product_description,
        icp_description: body.icp_description,
        value_propositions: body.value_propositions,
        case_studies: body.case_studies,
        faqs: body.faqs,
        calendly_link: body.calendly_link,
        additional_context: body.additional_context,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[brain POST]", err);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

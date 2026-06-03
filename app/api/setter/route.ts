import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";
import type { MembershipRow } from "@/types/database";
import type { SetterConfigData } from "@/types/brain";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { data: rawM } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
    const membership = rawM as Pick<MembershipRow, "workspace_id"> | null;
    if (!membership) return NextResponse.json({ error: "Sin workspace" }, { status: 404 });

    const { data: setter } = await supabase
      .from("setter_configs").select("*").eq("workspace_id", membership.workspace_id)
      .order("created_at", { ascending: true }).limit(1).single();

    // Obtener brain_id para asociar
    const { data: brain } = await supabase
      .from("brains").select("id").eq("workspace_id", membership.workspace_id)
      .single();

    const brainData = brain as { id: string } | null;
    return NextResponse.json({ setter: setter ?? null, brain_id: brainData?.id ?? null });
  } catch (err) {
    console.error("[setter GET]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

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

    const body = await req.json() as SetterConfigData;
    const admin = createAdminClient();

    const { data: brain } = await admin
      .from("brains").select("id").eq("workspace_id", membership.workspace_id).single();

    const payload = {
      workspace_id: membership.workspace_id,
      brain_id: brain?.id ?? null,
      name: body.name,
      language: body.language,
      tone: body.tone,
      objective: body.objective,
      qualification_questions: body.qualification_questions,
      objection_handlers: body.objection_handlers,
      handoff_rules: body.handoff_rules,
      min_messages_before_push: body.min_messages_before_push,
      opening_message: body.opening_message,
      closing_message: body.closing_message,
    };

    const { data: existing } = await admin
      .from("setter_configs").select("id").eq("workspace_id", membership.workspace_id)
      .single();

    if (existing) {
      await admin.from("setter_configs").update(payload).eq("id", existing.id);
    } else {
      await admin.from("setter_configs").insert({ ...payload, is_default: true });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[setter POST]", err);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

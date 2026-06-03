import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SetterForm } from "@/components/setter/SetterForm";
import type { SetterConfigData } from "@/types/brain";

export default async function SetterPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initial: SetterConfigData | null = null;

  if (user) {
    const { data: m } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();

    if (m) {
      const { data: setter } = await supabase
        .from("setter_configs").select("*").eq("workspace_id", (m as { workspace_id: string }).workspace_id)
        .order("created_at", { ascending: true }).limit(1).single();

      if (setter) {
        initial = setter as unknown as SetterConfigData;
      }
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configuración del Setter</h1>
        <p className="text-sm text-gray-500 mt-1">
          Definí cómo se llama tu setter, cómo habla, qué preguntas hace y cuándo tiene que pasarte el chat.
        </p>
      </div>
      <SetterForm initial={initial} />
    </div>
  );
}

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BrainForm } from "@/components/brain/BrainForm";
import type { BrainData } from "@/types/brain";

export default async function BrainPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let initial: BrainData | null = null;

  if (user) {
    const { data: m } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();

    if (m) {
      const { data: brain } = await supabase
        .from("brains").select("*").eq("workspace_id", (m as { workspace_id: string }).workspace_id)
        .order("created_at", { ascending: true }).limit(1).single();

      if (brain) {
        initial = brain as unknown as BrainData;
      }
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Cerebro IA</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enseñale a tu setter qué vendés, a quién le vendés y cómo convencer. Cuanto más detallado, mejor responde.
        </p>
      </div>
      <BrainForm initial={initial} />
    </div>
  );
}

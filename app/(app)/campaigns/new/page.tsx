import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import type { MembershipRow } from "@/types/database";

export default async function NewCampaignPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let workspaceId = "";
  let accounts: { id: string; display_name: string | null; unipile_account_id: string }[] = [];
  let setterConfigs: { id: string; name: string }[] = [];
  let brains: { id: string; name: string }[] = [];

  if (user) {
    const { data: rawM } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
    const m = rawM as Pick<MembershipRow, "workspace_id"> | null;

    if (m) {
      workspaceId = m.workspace_id;

      const [{ data: accts }, { data: setters }, { data: brainsData }] = await Promise.all([
        supabase.from("linkedin_accounts").select("id, display_name, unipile_account_id")
          .eq("workspace_id", m.workspace_id).eq("status", "active"),
        supabase.from("setter_configs").select("id, name").eq("workspace_id", m.workspace_id),
        supabase.from("brains").select("id, name").eq("workspace_id", m.workspace_id),
      ]);

      accounts = (accts ?? []) as typeof accounts;
      setterConfigs = (setters ?? []) as typeof setterConfigs;
      brains = (brainsData ?? []) as typeof brains;
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Nueva campaña</h1>
        <p className="text-sm text-gray-500 mt-1">Configurá el outreach en 3 pasos</p>
      </div>
      <CampaignWizard
        workspaceId={workspaceId}
        accounts={accounts}
        setterConfigs={setterConfigs}
        brains={brains}
      />
    </div>
  );
}

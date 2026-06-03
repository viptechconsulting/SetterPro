import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MembershipRow } from "@/types/database";
import type { Campaign } from "@/types/campaign";

export const revalidate = 0;

const statusLabel: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  paused: "Pausada",
  completed: "Completada",
};

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  completed: "bg-blue-100 text-blue-700",
};

export default async function CampaignsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let campaigns: Campaign[] = [];

  if (user) {
    const { data: rawM } = await supabase
      .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
    const m = rawM as Pick<MembershipRow, "workspace_id"> | null;

    if (m) {
      const { data } = await supabase
        .from("campaigns").select("*")
        .eq("workspace_id", m.workspace_id)
        .order("created_at", { ascending: false });
      campaigns = (data ?? []) as unknown as Campaign[];
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
          <p className="text-sm text-gray-500 mt-1">Outreach automático con tu setter IA</p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Nueva campaña
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <p className="text-4xl mb-3">🚀</p>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Sin campañas todavía</h3>
          <p className="text-sm text-gray-500 mb-6">Creá tu primera campaña para empezar a generar reuniones en automático.</p>
          <Link href="/campaigns/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
            Crear campaña
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[c.status]}`}>
                    {statusLabel[c.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{c.total_leads} leads · Cap {c.daily_cap}/día</p>
              </div>

              <div className="flex items-center gap-6 text-center text-sm shrink-0">
                <Stat label="Invitados" value={c.invited_count} />
                <Stat label="Conectados" value={c.connected_count} />
                <Stat label="Respondieron" value={c.replied_count} />
                <Stat label="Agendados" value={c.booked_count} color="text-emerald-600" />
              </div>

              <div className="flex gap-2 shrink-0">
                <CampaignToggle campaign={c} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "text-gray-900" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function CampaignToggle({ campaign }: { campaign: Campaign }) {
  const canActivate = campaign.status === "draft" || campaign.status === "paused";
  const canPause = campaign.status === "active";

  if (canActivate) {
    return (
      <form action={`/api/campaigns/${campaign.id}`} method="PATCH">
        <input type="hidden" name="status" value="active" />
        <button type="submit"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
          Activar
        </button>
      </form>
    );
  }

  if (canPause) {
    return (
      <form action={`/api/campaigns/${campaign.id}`} method="PATCH">
        <input type="hidden" name="status" value="paused" />
        <button type="submit"
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-300 transition-colors">
          Pausar
        </button>
      </form>
    );
  }

  return null;
}

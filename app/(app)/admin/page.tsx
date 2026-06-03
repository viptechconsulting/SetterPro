import { redirect } from "next/navigation";
import { createServerSupabaseClient, createAdminClient } from "@/lib/supabase/server";

export const revalidate = 0;

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;

// Cost estimates (USD)
const CLAUDE_COST_PER_REPLY = 0.003; // ~$0.003 per AI reply (input+output avg)
const UNIPILE_COST_PER_ACCOUNT_MONTH = 10; // rough estimate

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Super admin check
  if (!SUPER_ADMIN_EMAIL || user.email !== SUPER_ADMIN_EMAIL) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const [
    { count: workspaceCount },
    { count: accountCount },
    { count: activeAccountCount },
    { count: campaignCount },
    { count: leadCount },
    { count: invitedCount },
    { count: connectedCount },
    { count: bookedCount },
    { count: convCount },
    { count: repliesDoneCount },
    { data: rawWorkspaces },
  ] = await Promise.all([
    admin.from("workspaces").select("id", { count: "exact", head: true }),
    admin.from("linkedin_accounts").select("id", { count: "exact", head: true }),
    admin.from("linkedin_accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("campaigns").select("id", { count: "exact", head: true }),
    admin.from("campaign_leads").select("id", { count: "exact", head: true }),
    admin.from("campaign_leads").select("id", { count: "exact", head: true }).neq("status", "queued"),
    admin.from("campaign_leads").select("id", { count: "exact", head: true }).in("status", ["connected", "first_message_sent", "replied", "booked"]),
    admin.from("campaign_leads").select("id", { count: "exact", head: true }).eq("status", "booked"),
    admin.from("conversations").select("id", { count: "exact", head: true }),
    admin.from("pending_ai_replies").select("id", { count: "exact", head: true }).eq("status", "done"),
    admin.from("workspaces").select("id, name, plan, created_at"),
  ]);

  const estimatedClaudeCost = (repliesDoneCount ?? 0) * CLAUDE_COST_PER_REPLY;
  const estimatedUnipoleCost = (activeAccountCount ?? 0) * UNIPILE_COST_PER_ACCOUNT_MONTH;

  const workspaces = (rawWorkspaces ?? []) as {
    id: string; name: string; plan: string; created_at: string;
  }[];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Telemetría global de SetterPro</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <AdminStat label="Workspaces" value={workspaceCount ?? 0} />
        <AdminStat label="Cuentas LinkedIn" value={accountCount ?? 0} sub={`${activeAccountCount ?? 0} activas`} />
        <AdminStat label="Campañas" value={campaignCount ?? 0} />
        <AdminStat label="Conversaciones IA" value={convCount ?? 0} />
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Funnel de leads</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <FunnelStep label="Leads totales" value={leadCount ?? 0} color="bg-gray-100" />
          <FunnelStep label="Invitados" value={invitedCount ?? 0} color="bg-blue-100" />
          <FunnelStep label="Conectados" value={connectedCount ?? 0} color="bg-indigo-100" />
          <FunnelStep label="Agendados" value={bookedCount ?? 0} color="bg-emerald-100" textColor="text-emerald-700" />
          <FunnelStep
            label="Conv. rate"
            value={`${leadCount ? Math.round(((bookedCount ?? 0) / leadCount) * 100) : 0}%`}
            color="bg-amber-100"
            textColor="text-amber-700"
          />
        </div>
      </div>

      {/* Cost estimates */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Costos estimados (acumulado)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CostCard
            label="Claude (IA replies)"
            value={`$${estimatedClaudeCost.toFixed(2)}`}
            detail={`${repliesDoneCount ?? 0} respuestas × $${CLAUDE_COST_PER_REPLY}`}
          />
          <CostCard
            label="Unipile (estimado/mes)"
            value={`$${estimatedUnipoleCost.toFixed(0)}`}
            detail={`${activeAccountCount ?? 0} cuentas × $${UNIPILE_COST_PER_ACCOUNT_MONTH}/cuenta`}
          />
          <CostCard
            label="Total estimado"
            value={`$${(estimatedClaudeCost + estimatedUnipoleCost).toFixed(2)}`}
            detail="Claude acumulado + Unipile/mes"
            highlight
          />
        </div>
        <p className="text-xs text-gray-400 mt-3">* Estimaciones aproximadas. Claude: avg $0.003/reply. Unipile: según plan.</p>
      </div>

      {/* Workspaces table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Workspaces</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {workspaces.map((ws) => (
              <tr key={ws.id}>
                <td className="px-6 py-3 font-medium text-gray-900">{ws.name}</td>
                <td className="px-6 py-3">
                  <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5">
                    {ws.plan}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500">
                  {new Date(ws.created_at).toLocaleDateString("es")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminStat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function FunnelStep({ label, value, color, textColor = "text-gray-900" }: {
  label: string; value: number | string; color: string; textColor?: string;
}) {
  return (
    <div className={`rounded-lg ${color} p-3`}>
      <div className={`text-xl font-bold ${textColor}`}>{value}</div>
      <div className="text-xs text-gray-600 mt-0.5">{label}</div>
    </div>
  );
}

function CostCard({ label, value, detail, highlight }: {
  label: string; value: string; detail: string; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-blue-700" : "text-gray-900"}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{detail}</div>
    </div>
  );
}

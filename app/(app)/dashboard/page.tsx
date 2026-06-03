import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import type { MembershipRow, LinkedInAccount } from "@/types/database";

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawMembership } = await supabase
    .from("workspace_members").select("workspace_id").eq("user_id", user.id).single();
  const membership = rawMembership as Pick<MembershipRow, "workspace_id"> | null;

  let workspaceName: string | null = null;
  let problemAccounts: Pick<LinkedInAccount, "id" | "display_name" | "status">[] = [];
  let stats = { accounts: 0, campaigns: 0, conversations: 0, booked: 0 };
  let hasLinkedIn = false, hasBrain = false, hasSetter = false, hasCampaign = false;

  if (membership?.workspace_id) {
    const wid = membership.workspace_id;

    const [
      { data: rawWs },
      { data: rawAccounts },
      { data: rawBrain },
      { data: rawSetter },
      { count: campaignCount },
      { count: convCount },
      { count: bookedCount },
    ] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", wid).single(),
      supabase.from("linkedin_accounts").select("id, display_name, status").eq("workspace_id", wid),
      supabase.from("brains").select("id, product_description").eq("workspace_id", wid).single(),
      supabase.from("setter_configs").select("id").eq("workspace_id", wid).single(),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", wid),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("workspace_id", wid),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("workspace_id", wid).eq("lead_status", "booked"),
    ]);

    workspaceName = (rawWs as { name: string } | null)?.name ?? null;
    const allAccounts = (rawAccounts ?? []) as typeof problemAccounts;
    problemAccounts = allAccounts.filter((a) => a.status !== "active");

    hasLinkedIn = allAccounts.some((a) => a.status === "active");
    hasBrain = !!(rawBrain && (rawBrain as { product_description: string }).product_description);
    hasSetter = !!rawSetter;
    hasCampaign = (campaignCount ?? 0) > 0;

    stats = {
      accounts: allAccounts.filter((a) => a.status === "active").length,
      campaigns: campaignCount ?? 0,
      conversations: convCount ?? 0,
      booked: bookedCount ?? 0,
    };
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido{workspaceName ? `, ${workspaceName}` : ""}
        </h1>
        <p className="text-gray-500 mt-1">Panel de control de SetterPro</p>
      </div>

      {/* Reconnect alert */}
      {problemAccounts.length > 0 && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium text-red-800">
                {problemAccounts.length} cuenta{problemAccounts.length > 1 ? "s" : ""} desconectada{problemAccounts.length > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-red-600">
                {problemAccounts.map((a) => a.display_name ?? "Sin nombre").join(", ")} — el setter no puede enviar mensajes hasta que reconectes.
              </p>
            </div>
          </div>
          <Link href="/settings/accounts"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors shrink-0">
            Reconectar
          </Link>
        </div>
      )}

      {/* Onboarding */}
      <OnboardingChecklist
        hasLinkedIn={hasLinkedIn}
        hasBrain={hasBrain}
        hasSetter={hasSetter}
        hasCampaign={hasCampaign}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Cuentas activas" value={stats.accounts} icon="🔗" />
        <StatCard label="Campañas" value={stats.campaigns} icon="🚀" />
        <StatCard label="Conversaciones" value={stats.conversations} icon="💬" />
        <StatCard label="Reuniones agendadas" value={stats.booked} icon="📅" color="text-emerald-600" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard href="/campaigns/new" icon="🚀" title="Nueva campaña" description="Lanzá outreach automático desde una búsqueda de LinkedIn." cta="Crear campaña" />
        <DashboardCard href="/settings/brain" icon="🧠" title="Cerebro IA" description="Actualizá qué vende tu setter y cómo presenta tu producto." cta="Editar cerebro" />
        <DashboardCard href="/settings/accounts" icon="🔗" title="Cuentas LinkedIn" description="Gestioná las cuentas conectadas para el outreach." cta="Gestionar cuentas" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = "text-gray-900" }: {
  label: string; value: number; icon: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function DashboardCard({ href, icon, title, description, cta }: {
  href: string; icon: string; title: string; description: string; cta: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow group">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
      <span className="text-sm font-medium text-blue-600">{cta} →</span>
    </Link>
  );
}

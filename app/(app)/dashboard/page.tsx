import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MembershipRow, LinkedInAccount } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawMembership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .single();

  const membership = rawMembership as Pick<MembershipRow, "workspace_id"> | null;

  let workspaceName: string | null = null;
  if (membership?.workspace_id) {
    const { data: rawWs } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", membership.workspace_id)
      .single();
    workspaceName = (rawWs as { name: string } | null)?.name ?? null;
  }

  let problemAccounts: Pick<LinkedInAccount, "id" | "display_name" | "status">[] = [];
  if (membership?.workspace_id) {
    const { data: rawAccounts } = await supabase
      .from("linkedin_accounts")
      .select("id, display_name, status")
      .eq("workspace_id", membership.workspace_id)
      .neq("status", "active");
    problemAccounts = (rawAccounts ?? []) as typeof problemAccounts;
  }

  const alertCount = problemAccounts.length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido{workspaceName ? `, ${workspaceName}` : ""}
        </h1>
        <p className="text-gray-500 mt-1">Tu panel de control de SetterPro</p>
      </div>

      {alertCount > 0 && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-medium text-red-800">
                {alertCount} cuenta{alertCount > 1 ? "s" : ""} necesita{alertCount > 1 ? "n" : ""} atención
              </p>
              <p className="text-sm text-red-600">
                {problemAccounts.map((a) => a.display_name ?? "Sin nombre").join(", ")}
              </p>
            </div>
          </div>
          <Link
            href="/settings/accounts"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Ver cuentas
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard href="/settings/accounts" icon="🔗" title="Cuentas de LinkedIn" description="Conectá y gestioná tus cuentas de LinkedIn de forma segura." cta="Gestionar cuentas" />
        <DashboardCard href="/campaigns" icon="🚀" title="Campañas" description="Lanzá campañas de prospección automáticas." cta="Ver campañas" />
        <DashboardCard href="/inbox" icon="💬" title="Bandeja unificada" description="Supervisá todas las conversaciones de tu IA Setter." cta="Abrir bandeja" />
      </div>
    </div>
  );
}

function DashboardCard({ href, icon, title, description, cta }: {
  href: string; icon: string; title: string; description: string; cta: string;
}) {
  return (
    <Link href={href} className="rounded-xl border bg-white p-6 hover:shadow-md transition-shadow group">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{title}</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">{description}</p>
      <span className="text-sm font-medium text-blue-600">{cta} →</span>
    </Link>
  );
}

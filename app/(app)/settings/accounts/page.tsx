import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AccountCard } from "@/components/linkedin/AccountCard";
import { ConnectButton } from "@/components/linkedin/ConnectButton";
import type { LinkedInAccount, MembershipRow } from "@/types/database";

export const revalidate = 0;

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawMembership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  const membership = rawMembership as MembershipRow | null;
  if (!membership) redirect("/login");

  const { workspace_id: workspaceId, role } = membership;
  const canConnect = ["owner", "admin"].includes(role);

  const { data: rawAccounts, error } = await supabase
    .from("linkedin_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) console.error("[accounts/page]", error);

  const allAccounts = (rawAccounts ?? []) as LinkedInAccount[];
  const activeAccounts = allAccounts.filter((a) => a.status === "active");
  const problemAccounts = allAccounts.filter((a) => a.status !== "active");

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cuentas de LinkedIn</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Conectá tus cuentas de LinkedIn de forma segura. Tus credenciales nunca
            pasan por SetterPro — la autenticación ocurre directamente en LinkedIn
            a través del wizard seguro de Unipile.
          </p>
        </div>
        {canConnect && <ConnectButton workspaceId={workspaceId} />}
      </div>

      <div className="mb-6 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex gap-3">
        <span className="text-lg">🔒</span>
        <p className="text-sm text-blue-700">
          <strong>Conexión segura:</strong> Cuando hacés click en "Conectar LinkedIn",
          sos redirigido al wizard de Unipile donde ingresás tus credenciales directamente
          en LinkedIn. SetterPro solo recibe un ID de cuenta anonimizado — nunca tu contraseña.
        </p>
      </div>

      {allAccounts.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="text-4xl mb-3">🔗</div>
          <h3 className="font-semibold text-gray-900 mb-1">Conectá tu primera cuenta</h3>
          <p className="text-sm text-gray-500 mb-4">
            Conectá una cuenta de LinkedIn para empezar a prospectar automáticamente.
          </p>
          {canConnect ? (
            <ConnectButton workspaceId={workspaceId} />
          ) : (
            <p className="text-sm text-gray-400">Solo owners y admins pueden conectar cuentas.</p>
          )}
        </div>
      )}

      {problemAccounts.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Requieren atención</h2>
            <span className="rounded-full bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5">
              {problemAccounts.length}
            </span>
          </div>
          <div className="space-y-3">
            {problemAccounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </section>
      )}

      {activeAccounts.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Cuentas activas</h2>
            <span className="rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5">
              {activeAccounts.length}
            </span>
          </div>
          <div className="space-y-3">
            {activeAccounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </section>
      )}

      {allAccounts.length > 0 && (
        <div className="mt-8 rounded-xl bg-gray-50 border border-gray-100 px-4 py-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Límites de LinkedIn</h3>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>LinkedIn permite ~80–100 invitaciones por cuenta por día</li>
            <li>SetterPro usa un default conservador de 80/día con delays aleatorios</li>
            <li>Los contadores se resetean automáticamente a medianoche</li>
            <li>Si una cuenta llega al límite, las campañas continúan al día siguiente</li>
          </ul>
        </div>
      )}
    </div>
  );
}

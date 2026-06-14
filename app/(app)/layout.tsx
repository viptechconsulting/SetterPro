import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MembershipRow } from "@/types/database";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rawMembership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  const membership = rawMembership as Pick<MembershipRow, "workspace_id"> | null;

  let workspaceName: string | null = null;
  if (membership?.workspace_id) {
    const { data: rawWs } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", membership.workspace_id)
      .single();
    const ws = rawWs as { name: string } | null;
    workspaceName = ws?.name ?? null;
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-semibold text-sm truncate">
              {workspaceName ?? "SetterPro"}
            </span>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          <NavItem href="/dashboard" icon="🏠" label="Dashboard" />
          <NavItem href="/inbox" icon="💬" label="Bandeja" />
          <NavItem href="/campaigns" icon="🚀" label="Campañas" />
          <div className="pt-4 pb-1 px-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Configuración
            </p>
          </div>
          <NavItem href="/settings/accounts" icon="🔗" label="Cuentas LinkedIn" />
          <NavItem href="/settings/brain" icon="🧠" label="Cerebro IA" />
          <NavItem href="/settings/setter" icon="🤖" label="Setter" />
          <div className="pt-4 pb-1 px-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email AI
            </p>
          </div>
          <NavItem href="/email-drafts" icon="📬" label="Drafts" />
          <NavItem href="/email-policies" icon="📋" label="Políticas" />
          <NavItem href="/setup" icon="⚙️" label="Setup" />
          {SUPER_ADMIN_EMAIL && user?.email === SUPER_ADMIN_EMAIL && (
            <>
              <div className="pt-4 pb-1 px-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</p>
              </div>
              <NavItem href="/admin" icon="📊" label="Telemetría" />
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <form action="/api/auth/signout" method="POST" className="mt-2">
            <button type="submit" className="text-xs text-gray-400 hover:text-white transition-colors">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}

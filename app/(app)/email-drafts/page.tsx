import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { listDrafts, getDraftStats } from '@/lib/email-drafts';
import { DraftStatusBadge, RiskBadge } from '@/components/email-drafts/DraftStatusBadge';
import type { DraftStatus, RiskLevel } from '@/types/email-drafts';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: Promise<{ status?: string; risk?: string; page?: string }>;
};

export default async function EmailDraftsPage({ searchParams }: PageProps) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const sp      = await searchParams;
  const status  = sp.status ?? 'all';
  const risk    = sp.risk   ?? 'all';
  const page    = Math.max(parseInt(sp.page ?? '1', 10), 1);
  const limit   = 15;
  const offset  = (page - 1) * limit;

  const [stats, { drafts, total }] = await Promise.all([
    getDraftStats(),
    listDrafts({ status, risk, limit, offset }),
  ]);

  const totalPages = Math.ceil(total / limit);

  function filterLink(params: Record<string, string>) {
    const base = { status, risk, page: '1', ...params };
    return '/email-drafts?' + new URLSearchParams(base).toString();
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Draft Assistant</h1>
          <p className="text-gray-500 mt-1">Revisión y aprobación de respuestas generadas por IA</p>
        </div>
        <Link
          href="/email-policies"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          ⚙️ Políticas
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        <StatCard label="Pendientes" value={stats.pending} icon="🕐" color={stats.pending > 0 ? 'text-yellow-600' : 'text-gray-900'} />
        <StatCard label="Riesgo alto" value={stats.high_risk} icon="🔴" color={stats.high_risk > 0 ? 'text-red-600' : 'text-gray-900'} />
        <StatCard label="Aprobados" value={stats.approved} icon="✅" color="text-green-600" />
        <StatCard label="Editados" value={stats.edited} icon="✏️" color="text-blue-600" />
        <StatCard label="Rechazados" value={stats.rejected} icon="🚫" color="text-gray-600" />
        <StatCard label="Hoy" value={stats.total_today} icon="📅" />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(['all', 'pending_review', 'approved', 'edited', 'rejected'] as const).map(s => (
            <Link
              key={s}
              href={filterLink({ status: s })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                status === s ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'pending_review' ? 'Pendientes' : s === 'approved' ? 'Aprobados' : s === 'edited' ? 'Editados' : 'Rechazados'}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(['all', 'alto', 'medio', 'bajo'] as const).map(r => (
            <Link
              key={r}
              href={filterLink({ risk: r })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                risk === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r === 'all' ? 'Todos los riesgos' : r === 'alto' ? '🔴 Alto' : r === 'medio' ? '🟡 Medio' : '🟢 Bajo'}
            </Link>
          ))}
        </div>
      </div>

      {/* Draft list */}
      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-2xl mb-2">📬</p>
          <p className="text-gray-500 font-medium">No hay drafts con estos filtros</p>
          <p className="text-sm text-gray-400 mt-1">Los drafts aparecen aquí cuando n8n procesa un email entrante</p>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map(draft => (
            <Link
              key={draft.id}
              href={`/email-drafts/${draft.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {draft.customer_name ?? draft.from_email}
                    </span>
                    {draft.company_name && (
                      <span className="text-xs text-gray-400">— {draft.company_name}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 font-medium truncate mb-1">
                    {draft.original_subject ?? '(Sin asunto)'}
                  </p>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {draft.ai_case_summary ?? draft.original_body?.substring(0, 120)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <DraftStatusBadge status={draft.status as DraftStatus} />
                  <RiskBadge risk={draft.ai_risk_level as RiskLevel} />
                  <span className="text-xs text-gray-400">
                    {new Date(draft.created_at).toLocaleDateString('es-MX', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} drafts total</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={filterLink({ page: String(page - 1) })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                ← Anterior
              </Link>
            )}
            <span className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={filterLink({ page: String(page + 1) })}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color = 'text-gray-900' }: {
  label: string; value: number; icon: string; color?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

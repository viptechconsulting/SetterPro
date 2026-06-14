import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDraft } from '@/lib/email-drafts';
import { DraftStatusBadge, RiskBadge } from '@/components/email-drafts/DraftStatusBadge';
import { DraftActions } from '@/components/email-drafts/DraftActions';
import type { DraftStatus, RiskLevel } from '@/types/email-drafts';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function EmailDraftDetailPage({ params }: PageProps) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const maybeDraft = await getDraft(parseInt(id, 10));
  if (!maybeDraft) notFound();
  // notFound() throws; assertion satisfies TS in environments missing next/navigation types
  const draft = maybeDraft!;

  return (
    <div className="p-8 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/email-drafts" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Volver a Email Drafts
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {draft.original_subject ?? '(Sin asunto)'}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600">{draft.customer_name ?? draft.from_email}</span>
            {draft.company_name && <span className="text-sm text-gray-400">— {draft.company_name}</span>}
            <span className="text-sm text-gray-400">•</span>
            <span className="text-sm text-gray-400">{draft.from_email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge risk={draft.ai_risk_level as RiskLevel} />
          <DraftStatusBadge status={draft.status as DraftStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column — context */}
        <div className="lg:col-span-2 space-y-4">
          {/* Case summary */}
          {draft.ai_case_summary && (
            <Section title="Resumen del caso" icon="📝">
              <p className="text-sm text-gray-700 leading-relaxed">{draft.ai_case_summary}</p>
            </Section>
          )}

          {/* Original email */}
          <Section title="Email original" icon="📧">
            <div className="space-y-1.5">
              <Row label="De" value={`${draft.customer_name ?? ''} <${draft.from_email}>`} />
              <Row label="Asunto" value={draft.original_subject ?? '—'} />
              <Row label="Fecha" value={new Date(draft.created_at).toLocaleString('es-MX')} />
            </div>
            {draft.original_body && (
              <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 max-h-48 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{draft.original_body}</pre>
              </div>
            )}
          </Section>

          {/* QB data */}
          {draft.quickbooks_customer_id && (
            <Section title="QuickBooks" icon="📊">
              <Row label="QB Customer ID" value={draft.quickbooks_customer_id} />
              {draft.company_name && <Row label="Empresa" value={draft.company_name} />}
            </Section>
          )}

          {/* Human review notes from AI */}
          {draft.human_review_notes && draft.human_review_notes.length > 0 && (
            <Section title="Puntos a revisar (IA)" icon="⚠️">
              <ul className="space-y-1.5">
                {draft.human_review_notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="shrink-0 font-bold text-yellow-600">{i + 1}.</span>
                    {note}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Reasoning */}
          {draft.reasoning_for_human && (
            <Section title="Razonamiento de la IA" icon="🤔">
              <p className="text-sm text-gray-600 leading-relaxed">{draft.reasoning_for_human}</p>
            </Section>
          )}

          {/* Status info */}
          {draft.status !== 'pending_review' && (
            <Section title="Historial de revisión" icon="🕐">
              {draft.approved_by && <Row label="Aprobado por" value={draft.approved_by} />}
              {draft.approved_at && <Row label="Aprobado el" value={new Date(draft.approved_at).toLocaleString('es-MX')} />}
              {draft.rejection_reason && <Row label="Razón de rechazo" value={draft.rejection_reason} />}
              {draft.human_feedback && <Row label="Feedback humano" value={draft.human_feedback} />}
            </Section>
          )}
        </div>

        {/* Right column — AI draft + actions */}
        <div className="lg:col-span-3 space-y-4">
          {/* Suggested reply */}
          <Section title="Respuesta sugerida por IA" icon="💬">
            {draft.ai_suggested_subject && (
              <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-xs font-medium text-gray-500">Asunto: </span>
                <span className="text-sm text-gray-900">{draft.ai_suggested_subject}</span>
              </div>
            )}
            <div className="rounded-lg bg-white border border-gray-200 p-4 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                {draft.ai_suggested_reply ?? 'Sin respuesta generada'}
              </pre>
            </div>
          </Section>

          {/* Actions */}
          <Section title="Acciones" icon="🎯">
            <DraftActions draftId={draft.id} currentStatus={draft.status} />

            {draft.draft_id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Gmail Draft ID: <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">{draft.draft_id}</code>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Busca este borrador en Gmail para enviarlo manualmente.
                </p>
              </div>
            )}
          </Section>

          {/* Telegram commands */}
          <Section title="Comandos Telegram" icon="📱">
            <p className="text-xs text-gray-500 mb-2">Desde el bot de Telegram:</p>
            <div className="space-y-1.5">
              <code className="block text-xs bg-gray-900 text-green-400 rounded px-3 py-2 font-mono">
                APPROVE {draft.draft_id ?? 'DRAFT_ID'}
              </code>
              <code className="block text-xs bg-gray-900 text-blue-400 rounded px-3 py-2 font-mono">
                EDIT {draft.draft_id ?? 'DRAFT_ID'}: tu feedback aquí
              </code>
              <code className="block text-xs bg-gray-900 text-red-400 rounded px-3 py-2 font-mono">
                REJECT {draft.draft_id ?? 'DRAFT_ID'}: razón del rechazo
              </code>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 shrink-0 w-28">{label}:</span>
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  );
}

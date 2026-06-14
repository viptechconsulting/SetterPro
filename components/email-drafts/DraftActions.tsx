'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  draftId: number;
  currentStatus: string;
}

export function DraftActions({ draftId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const isPending = currentStatus === 'pending_review';

  async function patch(payload: object) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/email-drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleApprove() {
    patch({ status: 'approved' });
  }

  function handleReject() {
    if (!rejectionReason.trim()) return;
    patch({ status: 'rejected', rejection_reason: rejectionReason });
    setShowRejectForm(false);
    setRejectionReason('');
  }

  function handleSaveFeedback() {
    if (!feedback.trim()) return;
    patch({ human_feedback: feedback });
    setShowFeedbackForm(false);
    setFeedback('');
  }

  if (!isPending) {
    return (
      <div className="text-sm text-gray-500 italic">
        Draft ya procesado — status: <strong>{currentStatus}</strong>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          ✅ Aprobar draft
        </button>
        <button
          onClick={() => { setShowFeedbackForm(v => !v); setShowRejectForm(false); }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          ✏️ Agregar notas
        </button>
        <button
          onClick={() => { setShowRejectForm(v => !v); setShowFeedbackForm(false); }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          🚫 Rechazar
        </button>
      </div>

      {/* Reject form */}
      {showRejectForm && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">Razón del rechazo</p>
          <textarea
            value={rejectionReason}
            onChange={e => setRejectionReason(e.target.value)}
            rows={3}
            placeholder="Explica por qué se rechaza este draft..."
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={!rejectionReason.trim() || loading}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Confirmar rechazo
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Feedback form */}
      {showFeedbackForm && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-sm font-medium text-blue-800">Notas de revisión</p>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={3}
            placeholder="Agrega notas antes de aprobar o enviar por Telegram para reescritura..."
            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveFeedback}
              disabled={!feedback.trim() || loading}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Guardar notas
            </button>
            <button
              onClick={() => setShowFeedbackForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        ⚠️ Aprobar NO envía el email. Ve a Gmail Borradores para enviarlo manualmente.
      </p>
    </div>
  );
}

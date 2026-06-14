'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanyPolicy } from '@/types/email-drafts';

const CATEGORIES = ['general', 'operaciones', 'comercial', 'financiero', 'relaciones', 'legal', 'comunicacion'];

export function PolicyManager({ policies }: { policies: CompanyPolicy[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    policy_name: '',
    policy_text: '',
    category: 'general',
    priority: 10,
    active: true,
  });

  function resetForm() {
    setForm({ policy_name: '', policy_text: '', category: 'general', priority: 10, active: true });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(p: CompanyPolicy) {
    setForm({
      policy_name: p.policy_name,
      policy_text: p.policy_text,
      category: p.category,
      priority: p.priority,
      active: p.active,
    });
    setEditingId(p.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(-1);
    try {
      const url    = editingId ? `/api/email-policies/${editingId}` : '/api/email-policies';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      resetForm();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function toggleActive(p: CompanyPolicy) {
    setLoading(p.id);
    try {
      await fetch(`/api/email-policies/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta política?')) return;
    setLoading(id);
    try {
      await fetch(`/api/email-policies/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Add/Edit form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
          <h3 className="font-semibold text-blue-900">{editingId ? 'Editar política' : 'Nueva política'}</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de la política *</label>
              <input
                value={form.policy_name}
                onChange={e => setForm(f => ({ ...f, policy_name: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="ej. Sin precios sin aprobación"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value, 10) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Texto de la política *</label>
            <textarea
              value={form.policy_text}
              onChange={e => setForm(f => ({ ...f, policy_text: e.target.value }))}
              required
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Describe la regla que debe seguir la IA al redactar emails..."
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active-check"
              checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="active-check" className="text-sm text-gray-700">Política activa</label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading === -1}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading === -1 ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear política'}
            </button>
            <button type="button" onClick={resetForm} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Nueva política
        </button>
      )}

      {/* Policy list */}
      <div className="space-y-2">
        {policies.map(p => (
          <div
            key={p.id}
            className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${p.active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">{p.policy_name}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{p.category}</span>
                <span className="text-xs text-gray-400">Prioridad {p.priority}</span>
                {!p.active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">Inactiva</span>}
              </div>
              <p className="text-sm text-gray-600">{p.policy_text}</p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => toggleActive(p)}
                disabled={loading === p.id}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                {p.active ? 'Desactivar' : 'Activar'}
              </button>
              <button
                onClick={() => startEdit(p)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                disabled={loading === p.id}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

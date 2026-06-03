"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { personalizeTemplate } from "@/lib/campaigns/personalize";
import type { SearchResult } from "@/types/campaign";

interface Props {
  workspaceId: string;
  accounts: { id: string; display_name: string | null; unipile_account_id: string }[];
  setterConfigs: { id: string; name: string }[];
  brains: { id: string; name: string }[];
}

interface WizardState {
  name: string;
  searchUrl: string;
  searchParams: Record<string, unknown> | null;
  leads: SearchResult[];
  searchLoading: boolean;
  searchError: string | null;
  setterId: string;
  brainId: string;
  inviteNote: string;
  firstMessage: string;
  dailyCap: number;
  windowStart: number;
  windowEnd: number;
  accountIds: string[];
}

const STEPS = ["Fuente de leads", "Mensajería", "Ritmo y cuentas"];

export function CampaignWizard({ accounts, setterConfigs, brains }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<WizardState>({
    name: "",
    searchUrl: "",
    searchParams: null,
    leads: [],
    searchLoading: false,
    searchError: null,
    setterId: setterConfigs[0]?.id ?? "",
    brainId: brains[0]?.id ?? "",
    inviteNote: "Hola {{first_name}}, vi tu perfil y me pareció interesante conectar. Trabajo con founders de SaaS B2B.",
    firstMessage: "Hola {{first_name}}! Gracias por conectar 🙌 Te escribo porque ayudamos a empresas como {{company}} a generar más reuniones de ventas sin esfuerzo manual. ¿Tenés 2 minutos para contarte cómo?",
    dailyCap: 30,
    windowStart: 9,
    windowEnd: 18,
    accountIds: accounts.map((a) => a.id),
  });

  function update<K extends keyof WizardState>(key: K, val: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: val }));
  }

  // ── Step 1: search ────────────────────────────────────────────────────────
  async function runSearch() {
    if (!state.searchUrl.trim()) return;
    update("searchLoading", true);
    update("searchError", null);

    try {
      // Resolve URL → params
      const paramRes = await fetch(`/api/linkedin/search?url=${encodeURIComponent(state.searchUrl)}`);
      const paramJson = await paramRes.json() as { params?: Record<string, unknown>; error?: string };
      if (!paramRes.ok) throw new Error(paramJson.error ?? "Error resolviendo URL");

      const params = paramJson.params!;
      update("searchParams", params);

      // Run search
      const searchRes = await fetch("/api/linkedin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, count: 50 }),
      });
      const searchJson = await searchRes.json() as { items?: SearchResult[]; error?: string };
      if (!searchRes.ok) throw new Error(searchJson.error ?? "Error en la búsqueda");

      update("leads", searchJson.items ?? []);
    } catch (err) {
      update("searchError", err instanceof Error ? err.message : "Error desconocido");
    } finally {
      update("searchLoading", false);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name || `Campaña ${new Date().toLocaleDateString("es")}`,
          setter_config_id: state.setterId || null,
          brain_id: state.brainId || null,
          search_url: state.searchUrl,
          search_params: state.searchParams ?? {},
          leads: state.leads,
          invite_note_template: state.inviteNote,
          first_message_template: state.firstMessage,
          daily_cap: state.dailyCap,
          time_window_start: state.windowStart,
          time_window_end: state.windowEnd,
          account_ids: state.accountIds,
        }),
      });
      const json = await res.json() as { campaign_id?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Error al guardar");
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  const previewLead = state.leads[0];

  return (
    <div className="max-w-2xl">
      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold",
              i < step ? "bg-blue-600 text-white" :
              i === step ? "bg-blue-600 text-white" :
              "bg-gray-200 text-gray-500"
            )}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={cn("text-sm", i === step ? "font-semibold text-gray-900" : "text-gray-400")}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de la campaña</label>
            <input type="text" value={state.name} onChange={(e) => update("name", e.target.value)}
              placeholder="Ej: Founders SaaS B2B - Junio 2025"
              className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL de búsqueda de LinkedIn</label>
            <p className="text-xs text-gray-500 mb-2">Pegá la URL de una búsqueda de LinkedIn People o Sales Navigator</p>
            <div className="flex gap-2">
              <input type="url" value={state.searchUrl} onChange={(e) => update("searchUrl", e.target.value)}
                placeholder="https://www.linkedin.com/search/results/people/?keywords=..."
                className={inputClass} />
              <button onClick={runSearch} disabled={state.searchLoading || !state.searchUrl}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {state.searchLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>
            {state.searchError && <p className="text-sm text-red-600 mt-2">{state.searchError}</p>}
          </div>

          {state.leads.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{state.leads.length} leads encontrados</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {state.leads.slice(0, 10).map((lead) => (
                  <div key={lead.provider_id} className="px-4 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0">
                      {lead.first_name[0]}{lead.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{lead.first_name} {lead.last_name}</div>
                      <div className="text-xs text-gray-500 truncate">{lead.headline}</div>
                    </div>
                    {lead.company_name && (
                      <span className="text-xs text-gray-400 shrink-0">{lead.company_name}</span>
                    )}
                  </div>
                ))}
                {state.leads.length > 10 && (
                  <div className="px-4 py-2 text-xs text-gray-400 text-center">
                    +{state.leads.length - 10} más
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2 */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Setter a usar</label>
              <select value={state.setterId} onChange={(e) => update("setterId", e.target.value)} className={selectClass}>
                <option value="">Sin setter</option>
                {setterConfigs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cerebro IA</label>
              <select value={state.brainId} onChange={(e) => update("brainId", e.target.value)} className={selectClass}>
                <option value="">Sin cerebro</option>
                {brains.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nota de invitación <span className="text-gray-400 font-normal">(opcional, ≤300 caracteres)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Variables: <code className="bg-gray-100 px-1 rounded">{"{{first_name}}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{company}}"}</code>{" "}
              <code className="bg-gray-100 px-1 rounded">{"{{headline}}"}</code>
            </p>
            <textarea value={state.inviteNote} onChange={(e) => update("inviteNote", e.target.value)}
              rows={3} maxLength={300}
              className={cn(inputClass, "resize-none")} />
            <p className="text-xs text-gray-400 text-right mt-1">{state.inviteNote.length}/300</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Primer mensaje post-conexión</label>
            <textarea value={state.firstMessage} onChange={(e) => update("firstMessage", e.target.value)}
              rows={4} className={cn(inputClass, "resize-none")} />
          </div>

          {previewLead && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">
                Preview con {previewLead.first_name} {previewLead.last_name}
              </p>
              {state.inviteNote && (
                <div className="mb-3">
                  <p className="text-xs text-blue-600 mb-1">Nota de invitación:</p>
                  <p className="text-sm text-gray-800 bg-white rounded p-2 border border-blue-100">
                    {personalizeTemplate(state.inviteNote, previewLead)}
                  </p>
                </div>
              )}
              <p className="text-xs text-blue-600 mb-1">Primer mensaje:</p>
              <p className="text-sm text-gray-800 bg-white rounded p-2 border border-blue-100">
                {personalizeTemplate(state.firstMessage, previewLead)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 3 */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cap diario de invitaciones</label>
            <p className="text-xs text-gray-500 mb-2">LinkedIn recomienda máximo 80-100/día. Empezá con 30 si la cuenta es nueva.</p>
            <div className="flex items-center gap-3">
              <input type="number" min={5} max={100} value={state.dailyCap}
                onChange={(e) => update("dailyCap", parseInt(e.target.value) || 30)}
                className={cn(inputClass, "w-24 text-center")} />
              <span className="text-sm text-gray-500">invitaciones/día por cuenta</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ventana horaria</label>
            <div className="flex items-center gap-3">
              <select value={state.windowStart} onChange={(e) => update("windowStart", parseInt(e.target.value))} className={cn(selectClass, "w-32")}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00 hs</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">a</span>
              <select value={state.windowEnd} onChange={(e) => update("windowEnd", parseInt(e.target.value))} className={cn(selectClass, "w-32")}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00 hs</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Cuentas de LinkedIn a usar</label>
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-500">No hay cuentas activas. Conectá una en Configuración → Cuentas LinkedIn.</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((acct) => (
                  <label key={acct.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox"
                      checked={state.accountIds.includes(acct.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          update("accountIds", [...state.accountIds, acct.id]);
                        } else {
                          update("accountIds", state.accountIds.filter((id) => id !== acct.id));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-900">{acct.display_name ?? acct.unipile_account_id}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-900 mb-1">Resumen de la campaña</p>
            <p>{state.leads.length} leads · {state.dailyCap}/día · {state.windowStart}:00–{state.windowEnd}:00 hs</p>
            <p className="text-gray-400 mt-1">
              Duración estimada: ~{Math.ceil(state.leads.length / (state.dailyCap * state.accountIds.length || 1))} días hábiles
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
        <button onClick={() => setStep((s) => s - 1)} disabled={step === 0}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 disabled:opacity-0 transition-colors">
          ← Atrás
        </button>

        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && state.leads.length === 0}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              Siguiente →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving || state.accountIds.length === 0}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Crear campaña"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";
const selectClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";

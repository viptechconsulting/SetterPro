'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Check {
  ok: boolean;
  label: string;
  detail: string;
  action?: string;
}

interface StatusData {
  ok: boolean;
  checks: Record<string, Check>;
}

const CHECK_ORDER = [
  { key: 'supabase_config', step: 1, section: 'Supabase' },
  { key: 'db_tables',       step: 2, section: 'Supabase' },
  { key: 'policies_seeded', step: 3, section: 'Supabase' },
  { key: 'openai',          step: 4, section: 'n8n' },
  { key: 'quickbooks',      step: 5, section: 'n8n' },
  { key: 'telegram',        step: 6, section: 'n8n' },
  { key: 'gmail_label',     step: 7, section: 'n8n' },
];

const N8N_STEPS = [
  { step: 'A', label: 'Importar 01_main_workflow.json en n8n', detail: 'Workflows > Import from File' },
  { step: 'B', label: 'Importar 02_telegram_handler.json en n8n', detail: 'Workflows > Import from File' },
  { step: 'C', label: 'Configurar credenciales en cada nodo', detail: 'Gmail OAuth, QuickBooks OAuth, OpenAI, Telegram, PostgreSQL' },
  { step: 'D', label: 'Activar Telegram Handler primero', detail: 'Toggle "Active" en 02_telegram_handler.json' },
  { step: 'E', label: 'Activar Main Workflow', detail: 'Toggle "Active" en 01_main_workflow.json' },
  { step: 'F', label: 'Enviar email de prueba', detail: 'Ver docs/TESTING.md para el protocolo completo' },
];

export default function SetupStatusClient() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const refresh = () => {
    setLoading(true);
    fetch('/api/setup/status')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Setup del Sistema</h1>
          <p className="text-gray-500 mt-1">Estado de configuración del Email AI Draft Assistant</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? '⟳ Verificando...' : '↻ Actualizar'}
        </button>
      </div>

      {/* Overall status banner */}
      {data && (
        <div className={`mb-8 rounded-xl p-4 flex items-center gap-3 ${data.ok ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <span className="text-2xl">{data.ok ? '✅' : '⚙️'}</span>
          <div>
            <p className={`font-semibold ${data.ok ? 'text-green-800' : 'text-yellow-800'}`}>
              {data.ok ? 'Sistema listo para usar' : 'Configuración pendiente'}
            </p>
            <p className={`text-sm ${data.ok ? 'text-green-700' : 'text-yellow-700'}`}>
              {data.ok
                ? 'Todos los servicios están configurados. Activa los workflows en n8n.'
                : 'Completa los pasos marcados en rojo para activar el sistema.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Service checks */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            1. Variables de entorno y base de datos
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 animate-pulse h-16" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {CHECK_ORDER.map(({ key, step }) => {
                const check = data?.checks[key];
                if (!check) return null;
                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-4 ${check.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0">{check.ok ? '✅' : '❌'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${check.ok ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {step}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">{check.label}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{check.detail}</p>
                        {!check.ok && check.action && (
                          <p className="text-xs text-red-700 mt-1 font-medium">→ {check.action}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick env setup */}
          {data && !data.checks.supabase_config?.ok && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">Primero: crea tu .env.local</p>
              <p className="text-xs text-blue-700 mb-3">
                Copia <code className="bg-blue-100 px-1 rounded">.env.local.example</code> a <code className="bg-blue-100 px-1 rounded">.env.local</code> y completa los valores de Supabase.
              </p>
              <code className="block text-xs bg-gray-900 text-green-400 rounded p-3 font-mono">
                cp .env.local.example .env.local
              </code>
            </div>
          )}

          {/* Migration SQL */}
          {data?.checks.supabase_config?.ok && !data?.checks.db_tables?.ok && (
            <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-semibold text-orange-900 mb-2">Ejecutar migración en Supabase</p>
              <ol className="text-xs text-orange-800 space-y-1 list-decimal ml-4">
                <li>Ve a tu proyecto en supabase.com</li>
                <li>Abre SQL Editor</li>
                <li>Copia y ejecuta el contenido de <code className="bg-orange-100 px-1 rounded">supabase/migrations/005_email_drafts.sql</code></li>
              </ol>
            </div>
          )}
        </div>

        {/* n8n steps */}
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            2. Configurar n8n
          </h2>
          <div className="space-y-2">
            {N8N_STEPS.map(({ step, label, detail }) => (
              <div key={step} className="rounded-xl border border-gray-200 bg-white p-4 flex items-start gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Docs links */}
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Documentación</p>
            <div className="space-y-2">
              {[
                { href: '/api/setup/download/env', label: '📄 .env.local.example', sub: 'Plantilla de variables de entorno' },
              ].map(({ href: _href, label, sub }) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span className="text-blue-600">{label}</span>
                  <span className="text-gray-400 text-xs">— {sub}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-blue-600">📘 n8n-workflows/docs/SETUP.md</span>
                <span className="text-gray-400 text-xs">— Guía completa</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-blue-600">🧪 n8n-workflows/docs/TESTING.md</span>
                <span className="text-gray-400 text-xs">— Protocolo de pruebas</span>
              </div>
            </div>
          </div>

          {/* Actions when ready */}
          {data?.checks.supabase_config?.ok && data?.checks.db_tables?.ok && (
            <div className="mt-4">
              <Link
                href="/email-drafts"
                className="block rounded-xl bg-blue-600 p-4 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                → Ir al Email Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Connection string for n8n PostgreSQL node */}
      {data?.checks.supabase_config?.ok && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Configuración de PostgreSQL para n8n
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Usa estos datos en los nodos PostgreSQL del workflow de n8n:
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            {[
              ['Host', (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace('https://', 'db.').replace('.supabase.co', '.supabase.co').split('.supabase.co')[0] + '.supabase.co'],
              ['Puerto', '5432'],
              ['Database', 'postgres'],
              ['User', 'postgres'],
              ['SSL', 'Enabled (Required)'],
            ].map(([k, v]) => (
              <div key={k} className="rounded bg-gray-50 border border-gray-200 px-3 py-2">
                <span className="text-gray-500">{k}: </span>
                <span className="text-gray-900">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            La contraseña es tu SUPABASE_SERVICE_ROLE_KEY (o la contraseña de DB que configuraste).
          </p>
        </div>
      )}
    </div>
  );
}

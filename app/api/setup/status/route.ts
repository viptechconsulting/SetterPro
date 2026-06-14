import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ServiceCheck {
  ok: boolean;
  label: string;
  detail: string;
  action?: string;
}

export async function GET() {
  const checks: Record<string, ServiceCheck> = {};

  // 1. Supabase connection
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  checks.supabase_config = {
    ok:     supabaseUrl.includes('supabase.co') && serviceKey.length > 20,
    label:  'Variables de Supabase',
    detail: supabaseUrl.includes('supabase.co')
      ? `URL: ${supabaseUrl}`
      : 'NEXT_PUBLIC_SUPABASE_URL no configurada',
    action: 'Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local',
  };

  // 2. DB connection + tables
  if (checks.supabase_config.ok) {
    try {
      const supabase = createAdminClient();

      // Check tables exist
      const { data: tables, error: tblErr } = await supabase
        .from('information_schema.tables' as never)
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['ai_email_drafts', 'company_email_policies', 'ai_email_feedback_lessons']);

      const tableData = tables as { table_name: string }[] | null;

      if (tblErr || !tableData) {
        // Try direct query instead
        const { data: draftsCheck, error: draftsErr } = await supabase
          .from('ai_email_drafts')
          .select('id')
          .limit(1);

        checks.db_tables = {
          ok:     !draftsErr,
          label:  'Tablas de email drafts',
          detail: draftsErr ? `Error: ${draftsErr.message}` : 'ai_email_drafts accesible',
          action: 'Ejecuta supabase/migrations/005_email_drafts.sql en Supabase SQL Editor',
        };
      } else {
        const found = tableData.map(t => t.table_name);
        const missing = ['ai_email_drafts', 'company_email_policies', 'ai_email_feedback_lessons']
          .filter(t => !found.includes(t));

        checks.db_tables = {
          ok:     missing.length === 0,
          label:  'Tablas de email drafts',
          detail: missing.length === 0
            ? `3 tablas OK: ${found.join(', ')}`
            : `Faltan: ${missing.join(', ')}`,
          action: 'Ejecuta supabase/migrations/005_email_drafts.sql en Supabase SQL Editor',
        };
      }

      // Check policies seeded
      const { count, error: polErr } = await supabase
        .from('company_email_policies')
        .select('id', { count: 'exact', head: true });

      checks.policies_seeded = {
        ok:     !polErr && (count ?? 0) > 0,
        label:  'Políticas de empresa',
        detail: polErr
          ? `Error: ${polErr.message}`
          : `${count ?? 0} política(s) configurada(s)`,
        action: 'El SQL de migración incluye 10 políticas por defecto',
      };

    } catch (e) {
      checks.db_tables = {
        ok: false,
        label: 'Tablas de email drafts',
        detail: `Error de conexión: ${(e as Error).message}`,
        action: 'Verifica que SUPABASE_SERVICE_ROLE_KEY sea correcto',
      };
    }
  } else {
    checks.db_tables = {
      ok: false, label: 'Tablas de email drafts',
      detail: 'Requiere Supabase configurado primero',
      action: 'Configura Supabase primero',
    };
    checks.policies_seeded = {
      ok: false, label: 'Políticas de empresa',
      detail: 'Requiere Supabase configurado primero',
      action: 'Configura Supabase primero',
    };
  }

  // 3. External services (env var presence only)
  const envChecks: Array<[string, string, string, string]> = [
    ['OPENAI_API_KEY',          'openai',     'OpenAI API Key',           'Agrega OPENAI_API_KEY en .env.local (no requerida por el app, pero sí por n8n)'],
    ['TELEGRAM_BOT_TOKEN',      'telegram',   'Telegram Bot Token',       'Crea un bot con BotFather y agrega TELEGRAM_BOT_TOKEN'],
    ['QB_CLIENT_ID',            'quickbooks', 'QuickBooks OAuth',         'Crea una app en developer.intuit.com y configura QB_CLIENT_ID y QB_CLIENT_SECRET'],
    ['GMAIL_LABEL_AI_REVIEW',   'gmail_label','Gmail Label ID',           'Crea el label "AI Draft Created" en Gmail y agrega su ID'],
  ];

  for (const [envKey, key, label, action] of envChecks) {
    const val = process.env[envKey] ?? '';
    checks[key] = {
      ok:     val.length > 5,
      label,
      detail: val.length > 5 ? 'Configurado ✓' : `${envKey} no encontrado en env`,
      action,
    };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return NextResponse.json({ ok: allOk, checks });
}

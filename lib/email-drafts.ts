import { createAdminClient } from '@/lib/supabase/server';
import type { EmailDraft, EmailDraftStats, CompanyPolicy, FeedbackLesson, UpdateDraftPayload } from '@/types/email-drafts';

// ── Drafts ────────────────────────────────────────────────

export async function listDrafts(opts: {
  status?: string;
  risk?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ drafts: EmailDraft[]; total: number }> {
  const supabase = createAdminClient();
  const limit  = opts.limit  ?? 20;
  const offset = opts.offset ?? 0;

  let query = supabase
    .from('ai_email_drafts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  if (opts.risk   && opts.risk   !== 'all') query = query.eq('ai_risk_level', opts.risk);

  const { data, count, error } = await query;
  if (error) throw error;

  return { drafts: (data ?? []) as EmailDraft[], total: count ?? 0 };
}

export async function getDraft(id: number): Promise<EmailDraft | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_email_drafts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as EmailDraft;
}

export async function updateDraft(id: number, payload: UpdateDraftPayload): Promise<EmailDraft> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = { ...payload };
  if (payload.status === 'approved') {
    updates.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('ai_email_drafts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as EmailDraft;
}

export async function getDraftStats(): Promise<EmailDraftStats> {
  const supabase = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    { count: pending },
    { count: approved },
    { count: edited },
    { count: rejected },
    { count: total_today },
    { count: high_risk },
  ] = await Promise.all([
    supabase.from('ai_email_drafts').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('ai_email_drafts').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('ai_email_drafts').select('id', { count: 'exact', head: true }).eq('status', 'edited'),
    supabase.from('ai_email_drafts').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('ai_email_drafts').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
    supabase.from('ai_email_drafts').select('id', { count: 'exact', head: true }).eq('ai_risk_level', 'alto').eq('status', 'pending_review'),
  ]);

  return {
    pending:     pending  ?? 0,
    approved:    approved ?? 0,
    edited:      edited   ?? 0,
    rejected:    rejected ?? 0,
    total_today: total_today ?? 0,
    high_risk:   high_risk  ?? 0,
  };
}

// ── Policies ──────────────────────────────────────────────

export async function listPolicies(activeOnly = false): Promise<CompanyPolicy[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from('company_email_policies')
    .select('*')
    .order('priority', { ascending: true });

  if (activeOnly) query = query.eq('active', true);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CompanyPolicy[];
}

export async function createPolicy(p: Omit<CompanyPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<CompanyPolicy> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('company_email_policies')
    .insert(p)
    .select()
    .single();

  if (error) throw error;
  return data as CompanyPolicy;
}

export async function updatePolicy(id: number, p: Partial<CompanyPolicy>): Promise<CompanyPolicy> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('company_email_policies')
    .update(p)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CompanyPolicy;
}

export async function deletePolicy(id: number): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('company_email_policies').delete().eq('id', id);
  if (error) throw error;
}

// ── Lessons ───────────────────────────────────────────────

export async function listLessons(limit = 20): Promise<FeedbackLesson[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_email_feedback_lessons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as FeedbackLesson[];
}

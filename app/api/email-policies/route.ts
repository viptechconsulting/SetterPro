import { NextRequest, NextResponse } from 'next/server';
import { listPolicies, createPolicy } from '@/lib/email-drafts';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const activeOnly = req.nextUrl.searchParams.get('active') === 'true';
    const policies = await listPolicies(activeOnly);
    return NextResponse.json(policies);
  } catch (err) {
    console.error('[email-policies GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { policy_name, policy_text, category = 'general', priority = 10, active = true } = body;

    if (!policy_name?.trim() || !policy_text?.trim()) {
      return NextResponse.json({ error: 'policy_name and policy_text are required' }, { status: 400 });
    }

    const policy = await createPolicy({ policy_name, policy_text, category, priority, active });
    return NextResponse.json(policy, { status: 201 });
  } catch (err) {
    console.error('[email-policies POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

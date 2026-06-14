import { NextRequest, NextResponse } from 'next/server';
import { getDraft, updateDraft } from '@/lib/email-drafts';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { UpdateDraftPayload } from '@/types/email-drafts';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const draft = await getDraft(parseInt(id, 10));
    if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(draft);
  } catch (err) {
    console.error('[email-drafts/:id GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body: UpdateDraftPayload = await req.json();

    if (body.status === 'approved') {
      body.approved_by = user.email ?? user.id;
    }

    const updated = await updateDraft(parseInt(id, 10), body);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[email-drafts/:id PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

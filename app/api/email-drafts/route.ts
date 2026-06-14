import { NextRequest, NextResponse } from 'next/server';
import { listDrafts, getDraftStats } from '@/lib/email-drafts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const view   = searchParams.get('view') ?? 'list';
    const status = searchParams.get('status') ?? 'all';
    const risk   = searchParams.get('risk')   ?? 'all';
    const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '20', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0',  10), 0);

    if (view === 'stats') {
      const stats = await getDraftStats();
      return NextResponse.json(stats);
    }

    const { drafts, total } = await listDrafts({ status, risk, limit, offset });
    return NextResponse.json({ drafts, total, limit, offset });
  } catch (err) {
    console.error('[email-drafts GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

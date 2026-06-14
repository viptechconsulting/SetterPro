import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import SetupStatusClient from './SetupClient';

export const dynamic = 'force-dynamic';

export default async function SetupPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <SetupStatusClient />;
}

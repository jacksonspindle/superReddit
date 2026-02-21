import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { project_id } = await request.json();

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  // Get project's existing subreddits
  const { data: projectSubs } = await supabase
    .from('subreddits')
    .select('name')
    .eq('project_id', project_id);

  if (!projectSubs?.length) {
    return NextResponse.json({ subs: [] });
  }

  // Upsert into monitored subs
  const monitoredSubs = projectSubs.map((s) => ({
    project_id,
    name: s.name.toLowerCase().replace(/^r\//, ''),
    is_active: true,
    safety_level: 'caution',
  }));

  await supabase
    .from('outreach_monitored_subs')
    .upsert(monitoredSubs, { onConflict: 'project_id,name' });

  // Return all monitored subs
  const { data: subs } = await supabase
    .from('outreach_monitored_subs')
    .select('*')
    .eq('project_id', project_id)
    .order('name', { ascending: true });

  return NextResponse.json({ subs: subs || [] });
}

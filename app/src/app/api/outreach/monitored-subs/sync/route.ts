import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { project_id } = await request.json();

  if (!project_id) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  // Get project's existing subreddits
  const { data: projectSubs, error: fetchError } = await supabase
    .from('subreddits')
    .select('name')
    .eq('project_id', project_id);

  if (fetchError) {
    console.error('Sync: failed to fetch project subreddits:', fetchError.message);
    return NextResponse.json({ subs: [] });
  }

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

  const { error: upsertError } = await supabase
    .from('outreach_monitored_subs')
    .upsert(monitoredSubs, { onConflict: 'project_id,name' });

  if (upsertError) {
    console.error('Sync: failed to upsert monitored subs:', upsertError.message);
    // Fallback: return project subreddits directly as if they were monitored
    const fallbackSubs = projectSubs.map((s) => ({
      id: `fallback-${s.name}`,
      project_id,
      name: s.name.toLowerCase().replace(/^r\//, ''),
      is_active: true,
      safety_level: 'caution',
      last_polled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    return NextResponse.json({ subs: fallbackSubs });
  }

  // Return all monitored subs
  const { data: subs } = await supabase
    .from('outreach_monitored_subs')
    .select('*')
    .eq('project_id', project_id)
    .order('name', { ascending: true });

  return NextResponse.json({ subs: subs || [] });
}

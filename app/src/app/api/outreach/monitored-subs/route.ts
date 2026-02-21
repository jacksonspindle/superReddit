import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const projectId = request.nextUrl.searchParams.get('project_id');

  if (!projectId) {
    return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  }

  const { data: subs, error } = await supabase
    .from('outreach_monitored_subs')
    .select('*')
    .eq('project_id', projectId)
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subs });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { project_id, name } = await request.json();

  if (!project_id || !name) {
    return NextResponse.json(
      { error: 'project_id and name required' },
      { status: 400 }
    );
  }

  const cleanName = name.toLowerCase().replace(/^r\//, '').trim();

  const { data: sub, error } = await supabase
    .from('outreach_monitored_subs')
    .upsert(
      {
        project_id,
        name: cleanName,
        is_active: true,
        safety_level: 'caution',
      },
      { onConflict: 'project_id,name' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sub });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { id, ...updates } = await request.json();

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('outreach_monitored_subs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('outreach_monitored_subs')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

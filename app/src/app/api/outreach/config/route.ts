import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('outreach_configs')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('Outreach config GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch outreach config' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, ...updates } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Upsert: create config row if it doesn't exist, otherwise update
    const { data, error } = await supabase
      .from('outreach_configs')
      .upsert(
        { project_id, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'project_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('Outreach config PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update outreach config' }, { status: 500 });
  }
}

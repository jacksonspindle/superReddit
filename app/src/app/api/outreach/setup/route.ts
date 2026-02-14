import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, keywords, competitors, reddit_username } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('outreach_configs')
      .upsert(
        {
          project_id,
          keywords: keywords || [],
          competitors: competitors || [],
          reddit_username: reddit_username || null,
          setup_completed: true,
        },
        { onConflict: 'project_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: data });
  } catch (error) {
    console.error('Outreach setup error:', error);
    return NextResponse.json({ error: 'Failed to save outreach config' }, { status: 500 });
  }
}

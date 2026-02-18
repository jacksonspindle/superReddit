import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_FIELDS = ['keywords', 'competitors', 'reddit_username'];

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, ...fields } = body;

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // Filter to allowed fields only
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in fields) {
        updates[key] = fields[key];
      }
    }

    if ('keywords' in updates) {
      const kw = updates.keywords;
      updates.setup_completed = Array.isArray(kw) && kw.length > 0;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if config exists
    const { data: existing } = await supabase
      .from('outreach_configs')
      .select('id')
      .eq('project_id', project_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('outreach_configs')
        .update(updates)
        .eq('project_id', project_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Create new config with the provided fields
      const { error } = await supabase
        .from('outreach_configs')
        .insert({ project_id, ...updates });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Context outreach PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update outreach config' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, realtime_enabled, digest_enabled, digest_frequency } =
      body;

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Validate session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', session.user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      project_id,
      updated_at: new Date().toISOString(),
    };

    if (realtime_enabled !== undefined) {
      updates.email_realtime_enabled = realtime_enabled;
    }
    if (digest_enabled !== undefined) {
      updates.email_digest_enabled = digest_enabled;
    }
    if (digest_frequency !== undefined) {
      updates.email_digest_frequency = digest_frequency;
    }

    const { error: updateError } = await supabase
      .from('outreach_configs')
      .upsert(updates, { onConflict: 'project_id' });

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to update email preferences' },
      { status: 500 }
    );
  }
}

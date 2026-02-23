import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, email } = body;

    if (!project_id || !email) {
      return NextResponse.json(
        { error: 'project_id and email are required' },
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

    // Connect email directly (no verification code needed)
    const { error: updateError } = await supabase
      .from('outreach_configs')
      .upsert(
        {
          project_id,
          email_address: email,
          email_connected: true,
          email_verified: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' }
      );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect email' },
      { status: 500 }
    );
  }
}

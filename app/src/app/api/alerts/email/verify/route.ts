import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, code } = body;

    if (!project_id || !code) {
      return NextResponse.json(
        { error: 'project_id and code are required' },
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

    // Look up stored verification code from Supabase
    const serviceClient = await createServiceClient();
    const { data: stored, error: lookupError } = await serviceClient
      .from('email_verification_codes')
      .select('id, email, code, expires_at')
      .eq('project_id', project_id)
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lookupError || !stored) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > new Date(stored.expires_at)) {
      // Clean up expired code
      await serviceClient
        .from('email_verification_codes')
        .delete()
        .eq('id', stored.id);
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // Check code matches
    if (stored.code !== code) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // Code is valid - update outreach_configs
    const { error: updateError } = await supabase
      .from('outreach_configs')
      .upsert(
        {
          project_id,
          email_connected: true,
          email_verified: true,
          email_address: stored.email,
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

    // Clear the verification entry
    await serviceClient
      .from('email_verification_codes')
      .delete()
      .eq('id', stored.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Validate user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { project_id } = await request.json();

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', session.user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Generate a unique token and set expiry to 15 minutes from now
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Create pending connection row
    const { error: insertError } = await supabase
      .from('pending_telegram_connections')
      .insert({
        project_id,
        user_id: session.user.id,
        token,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Failed to create pending telegram connection:', insertError);
      return NextResponse.json(
        { error: 'Failed to create connection request' },
        { status: 500 }
      );
    }

    const link = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`;

    return NextResponse.json({ link, token });
  } catch (error) {
    console.error('Telegram connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Telegram connection' },
      { status: 500 }
    );
  }
}

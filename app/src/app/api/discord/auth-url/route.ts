import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Validate user session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json(
      { error: 'project_id is required' },
      { status: 400 }
    );
  }

  // Verify user owns this project
  const { data: project, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', session.user.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Discord integration not configured' },
      { status: 500 }
    );
  }

  // Encode state with project_id and user_id
  const state = Buffer.from(
    JSON.stringify({ project_id: projectId, user_id: session.user.id })
  ).toString('base64');

  // Bot permissions: MANAGE_CHANNELS (0x10) + MANAGE_WEBHOOKS (0x20000000)
  const permissions = (0x10 | 0x20000000).toString();

  const params = new URLSearchParams({
    client_id: clientId,
    permissions,
    scope: 'bot applications.commands',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

  return NextResponse.json({ auth_url: authUrl });
}

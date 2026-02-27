import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = request.nextUrl.searchParams.get('project_id');
  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
  }

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
  const redirectUri = process.env.DISCORD_REDIRECT_URI?.replace('/api/discord/callback', '/api/discord/dm-callback');

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'Discord integration not configured' }, { status: 500 });
  }

  const state = Buffer.from(
    JSON.stringify({ project_id: projectId, user_id: session.user.id, mode: 'dm' })
  ).toString('base64');

  // DM-only: no bot permissions needed, just identify the user
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'identify',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

  return NextResponse.json({ auth_url: authUrl });
}

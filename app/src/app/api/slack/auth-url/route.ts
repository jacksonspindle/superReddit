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

  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Slack integration not configured' },
      { status: 500 }
    );
  }

  // Encode state with project_id and user_id
  const state = Buffer.from(
    JSON.stringify({ project_id: projectId, user_id: session.user.id })
  ).toString('base64');

  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'incoming-webhook,channels:read,chat:write',
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

  return NextResponse.json({ auth_url: authUrl });
}

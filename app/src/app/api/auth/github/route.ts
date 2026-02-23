import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  const returnTo = request.nextUrl.searchParams.get('returnTo');

  if (!projectId && !returnTo) {
    return NextResponse.json({ error: 'projectId or returnTo is required' }, { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'GitHub OAuth is not configured' }, { status: 500 });
  }

  // Encode projectId or returnTo in state parameter
  const statePayload: Record<string, string> = {};
  if (projectId) statePayload.projectId = projectId;
  if (returnTo) statePayload.returnTo = returnTo;
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo',
    state,
  });

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

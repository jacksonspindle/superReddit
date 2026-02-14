import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  let projectId: string | undefined;
  let returnTo: string | undefined;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    projectId = decoded.projectId;
    returnTo = decoded.returnTo;
  } catch {
    return NextResponse.redirect(new URL('/projects', request.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const fallback = projectId ? `/projects/${projectId}/context/github` : returnTo || '/projects';
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    const fallback = projectId ? `/projects/${projectId}/context/github` : returnTo || '/projects';
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  if (projectId) {
    // Store the token in github_connections (upsert)
    const supabase = await createClient();
    await supabase
      .from('github_connections')
      .upsert(
        {
          project_id: projectId,
          access_token: accessToken,
          repo_url: '',
          owner: '',
          repo_name: '',
        },
        { onConflict: 'project_id' }
      );

    return NextResponse.redirect(new URL(`/projects/${projectId}/context/github?oauth=success`, request.url));
  }

  // No projectId — store token in a cookie and redirect to returnTo
  const redirectUrl = new URL(returnTo || '/projects', request.url);
  redirectUrl.searchParams.set('github', 'connected');
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('github_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return response;
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/alerts?error=missing_params', request.url));
  }

  let state: { project_id: string; user_id: string; mode: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.redirect(new URL('/alerts?error=invalid_state', request.url));
  }

  if (state.mode !== 'dm') {
    return NextResponse.redirect(new URL('/alerts?error=invalid_mode', request.url));
  }

  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || session.user.id !== state.user_id) {
    return NextResponse.redirect(new URL('/alerts?error=unauthorized', request.url));
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI?.replace('/api/discord/callback', '/api/discord/dm-callback');

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(new URL('/alerts?error=server_config', request.url));
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('DM token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(new URL('/alerts?error=token_exchange', request.url));
    }

    const tokenData = await tokenResponse.json();

    // Fetch the user's Discord profile
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('Discord user fetch failed:', await userResponse.text());
      return NextResponse.redirect(new URL('/alerts?error=user_fetch', request.url));
    }

    const discordUser = await userResponse.json();

    // Save the Discord user ID for DM delivery
    const serviceClient = await createServiceClient();

    const { error: configError } = await serviceClient
      .from('outreach_configs')
      .upsert(
        {
          project_id: state.project_id,
          discord_dm_user_id: discordUser.id,
          discord_dm_username: `${discordUser.username}${discordUser.discriminator !== '0' ? `#${discordUser.discriminator}` : ''}`,
          discord_dm_connected: true,
        },
        { onConflict: 'project_id' }
      );

    if (configError) {
      console.error('DM config update failed:', configError);
      return new NextResponse(
        `<!DOCTYPE html>
<html><head><title>Connection Failed</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
<p style="font-size:18px;color:#b91c1c">Discord DM connection failed. Please try again.</p>
</body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new NextResponse(
      `<!DOCTYPE html>
<html><head><title>Discord DMs Connected</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
<p style="font-size:18px;color:#111">Discord DMs connected! You can close this window.</p>
<script>setTimeout(()=>window.close(),1500)</script>
</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Discord DM callback error:', error);
    return NextResponse.redirect(new URL('/alerts?error=unknown', request.url));
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/alerts?error=missing_params', request.url));
  }

  // Decode state
  let state: { project_id: string; user_id: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.redirect(new URL('/alerts?error=invalid_state', request.url));
  }

  const supabase = await createClient();

  // Verify session matches state
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session || session.user.id !== state.user_id) {
    return NextResponse.redirect(new URL('/alerts?error=unauthorized', request.url));
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL('/alerts?error=server_config', request.url)
    );
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Slack token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(new URL('/alerts?error=token_exchange', request.url));
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('Slack OAuth error:', tokenData.error);
      return NextResponse.redirect(new URL('/alerts?error=token_exchange', request.url));
    }

    const webhookUrl = tokenData.incoming_webhook?.url;
    const channelName = tokenData.incoming_webhook?.channel;
    const channelId = tokenData.incoming_webhook?.channel_id;
    const teamId = tokenData.team?.id;
    const teamName = tokenData.team?.name;
    const accessToken = tokenData.access_token;

    if (!webhookUrl || !teamId) {
      console.error('Slack response missing required fields:', tokenData);
      return NextResponse.redirect(new URL('/alerts?error=missing_slack_data', request.url));
    }

    // Update outreach_configs with Slack columns
    const { error: configError } = await supabase
      .from('outreach_configs')
      .update({
        slack_team_id: teamId,
        slack_team_name: teamName,
        slack_channel_id: channelId,
        slack_channel_name: channelName,
        slack_webhook_url: webhookUrl,
        slack_access_token: accessToken,
        slack_connected: true,
      })
      .eq('project_id', state.project_id);

    if (configError) {
      console.error('Config update failed:', configError);
      return NextResponse.redirect(new URL('/alerts?error=db_error', request.url));
    }

    // Redirect to the outreach alerts page
    const redirectUrl = `/projects/${state.project_id}/outreach/alerts?slack_connected=true`;
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error('Slack callback error:', error);
    return NextResponse.redirect(new URL('/alerts?error=unknown', request.url));
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');
  const guildId = request.nextUrl.searchParams.get('guild_id');

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

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!clientId || !clientSecret || !redirectUri || !botToken) {
    return NextResponse.redirect(
      new URL('/alerts?error=server_config', request.url)
    );
  }

  try {
    // Exchange code for token
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
      console.error('Token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(new URL('/alerts?error=token_exchange', request.url));
    }

    const tokenData = await tokenResponse.json();
    const resolvedGuildId = guildId || tokenData.guild?.id;

    if (!resolvedGuildId) {
      return NextResponse.redirect(new URL('/alerts?error=no_guild', request.url));
    }

    // Get guild info
    const guildResponse = await fetch(
      `https://discord.com/api/v10/guilds/${resolvedGuildId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    const guildData = guildResponse.ok ? await guildResponse.json() : null;
    const guildName = guildData?.name || 'Unknown Server';

    // Create private #superreddit-alerts channel
    const channelResponse = await fetch(
      `https://discord.com/api/v10/guilds/${resolvedGuildId}/channels`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'superreddit-alerts',
          type: 0, // GUILD_TEXT
          topic: 'SuperReddit keyword alerts for Reddit monitoring',
          permission_overwrites: [
            {
              // @everyone - deny VIEW_CHANNEL
              id: resolvedGuildId,
              type: 0, // role
              deny: '1024', // VIEW_CHANNEL
            },
          ],
        }),
      }
    );

    if (!channelResponse.ok) {
      console.error('Channel creation failed:', await channelResponse.text());
      return NextResponse.redirect(new URL('/alerts?error=channel_creation', request.url));
    }

    const channelData = await channelResponse.json();

    // Create webhook in the channel
    const webhookResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelData.id}/webhooks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'SuperReddit Alerts',
        }),
      }
    );

    if (!webhookResponse.ok) {
      console.error('Webhook creation failed:', await webhookResponse.text());
      return NextResponse.redirect(new URL('/alerts?error=webhook_creation', request.url));
    }

    const webhookData = await webhookResponse.json();

    // Use service client for DB operations (bypasses RLS)
    const serviceClient = await createServiceClient();

    // Upsert outreach_configs with Discord columns (unified table)
    const { error: configError } = await serviceClient
      .from('outreach_configs')
      .upsert({
        project_id: state.project_id,
        discord_guild_id: resolvedGuildId,
        discord_guild_name: guildName,
        discord_channel_id: channelData.id,
        discord_webhook_url: webhookData.url,
        discord_connected: true,
      }, { onConflict: 'project_id' });

    if (configError) {
      console.error('Config update failed:', configError);
      return new NextResponse(
        `<!DOCTYPE html>
<html><head><title>Connection Failed</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
<p style="font-size:18px;color:#b91c1c">Discord connection failed. Please try again.</p>
</body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Sync project's existing subreddits into outreach_monitored_subs
    const { data: projectSubreddits } = await serviceClient
      .from('subreddits')
      .select('name')
      .eq('project_id', state.project_id);

    if (projectSubreddits?.length) {
      const monitoredSubs = projectSubreddits.map((s) => ({
        project_id: state.project_id,
        name: s.name.toLowerCase().replace(/^r\//, ''),
        is_active: true,
        safety_level: 'caution',
      }));

      await serviceClient
        .from('outreach_monitored_subs')
        .upsert(monitoredSubs, { onConflict: 'project_id,name' });
    }

    // Return a self-closing HTML page (parent polls for connection)
    return new NextResponse(
      `<!DOCTYPE html>
<html><head><title>Discord Connected</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
<p style="font-size:18px;color:#111">Discord connected! You can close this window.</p>
<script>setTimeout(()=>window.close(),1500)</script>
</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Discord callback error:', error);
    return NextResponse.redirect(new URL('/alerts?error=unknown', request.url));
  }
}

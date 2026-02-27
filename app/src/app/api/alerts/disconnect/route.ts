import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { project_id, channel } = await request.json();

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    if (!channel || !['discord', 'discord_dm', 'slack', 'email', 'telegram'].includes(channel)) {
      return NextResponse.json(
        { error: 'channel must be one of: discord, discord_dm, slack, email, telegram' },
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

    // Validate project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 403 });
    }

    // Build the clear object based on channel
    let clearData: Record<string, unknown>;

    switch (channel) {
      case 'discord':
        clearData = {
          discord_connected: false,
          discord_guild_id: null,
          discord_guild_name: null,
          discord_channel_id: null,
          discord_webhook_url: null,
        };
        break;
      case 'discord_dm':
        clearData = {
          discord_dm_connected: false,
          discord_dm_user_id: null,
          discord_dm_username: null,
        };
        break;
      case 'slack':
        clearData = {
          slack_connected: false,
          slack_team_id: null,
          slack_team_name: null,
          slack_channel_id: null,
          slack_channel_name: null,
          slack_webhook_url: null,
          slack_access_token: null,
        };
        break;
      case 'email':
        clearData = {
          email_connected: false,
          email_verified: false,
          email_address: null,
          email_realtime_enabled: true,
          email_digest_enabled: false,
        };
        break;
      case 'telegram':
        clearData = {
          telegram_connected: false,
          telegram_chat_id: null,
          telegram_username: null,
        };
        break;
      default:
        return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }

    const { error } = await supabase
      .from('outreach_configs')
      .update(clearData)
      .eq('project_id', project_id);

    if (error) {
      console.error('Disconnect error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alerts disconnect error:', error);
    return NextResponse.json({ error: 'Failed to disconnect channel' }, { status: 500 });
  }
}

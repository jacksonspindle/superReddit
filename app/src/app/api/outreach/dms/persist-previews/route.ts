import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Batch-persist chat preview text for DMs:
 * - "You:" previews → dm_body (what user sent)
 * - Their replies → last_reply_text (what they sent back)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, previews } = body as {
      project_id: string;
      previews: Record<string, { text: string; fromYou: boolean }>;
    };

    if (!project_id || !previews || Object.keys(previews).length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Get all DMs for this project in sent/responded stages
    const { data: dms } = await supabase
      .from('outreach_dms')
      .select('id, reddit_username, dm_body, last_reply_text, pipeline_stage')
      .eq('project_id', project_id)
      .in('pipeline_stage', ['dm_sent', 'responded']);

    if (!dms || dms.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    let updated = 0;
    for (const dm of dms) {
      const key = dm.reddit_username.toLowerCase();
      const preview = previews[key];
      if (!preview?.text) continue;

      const updates: Record<string, string> = {};

      if (preview.fromYou && !dm.dm_body) {
        updates.dm_body = preview.text;
      }
      if (!preview.fromYou && dm.last_reply_text !== preview.text) {
        // Always update reply text to latest message (they may have sent more)
        updates.last_reply_text = preview.text;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('outreach_dms')
          .update(updates)
          .eq('id', dm.id);
        if (!error) updated++;
      }
    }

    return NextResponse.json({ updated });
  } catch (error) {
    console.error('Persist previews error:', error);
    return NextResponse.json({ error: 'Failed to persist previews' }, { status: 500 });
  }
}

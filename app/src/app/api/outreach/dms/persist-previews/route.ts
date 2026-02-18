import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Batch-persist chat preview text as dm_body for DMs that don't have one yet.
 * Called after fetchPreviews() returns data from the Chrome extension.
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

    // Get all DMs for this project that don't have dm_body yet
    const { data: dms } = await supabase
      .from('outreach_dms')
      .select('id, reddit_username, dm_body')
      .eq('project_id', project_id)
      .is('dm_body', null);

    if (!dms || dms.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    let updated = 0;
    for (const dm of dms) {
      const key = dm.reddit_username.toLowerCase();
      const preview = previews[key];
      if (preview?.text && preview.fromYou) {
        const { error } = await supabase
          .from('outreach_dms')
          .update({ dm_body: preview.text })
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

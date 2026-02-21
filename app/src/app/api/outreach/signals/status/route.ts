import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signal_id, status, is_favorited, is_unseen } = body;

    if (!signal_id) {
      return NextResponse.json({ error: 'signal_id is required' }, { status: 400 });
    }

    // Build update payload
    const update: Record<string, unknown> = {};

    if (status !== undefined) {
      const validStatuses = ['new', 'replied', 'dismissed', 'converted'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      update.status = status;
    }

    if (typeof is_favorited === 'boolean') {
      update.is_favorited = is_favorited;
    }

    if (typeof is_unseen === 'boolean') {
      update.is_unseen = is_unseen;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('outreach_signals')
      .update(update)
      .eq('id', signal_id);

    if (error) {
      // V2 columns may not exist yet, retry with only base fields
      const baseUpdate: Record<string, unknown> = {};
      if (update.status !== undefined) baseUpdate.status = update.status;

      if (Object.keys(baseUpdate).length > 0) {
        const { error: retryError } = await supabase
          .from('outreach_signals')
          .update(baseUpdate)
          .eq('id', signal_id);

        if (retryError) {
          return NextResponse.json({ error: retryError.message }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signal status update error:', error);
    return NextResponse.json({ error: 'Failed to update signal status' }, { status: 500 });
  }
}

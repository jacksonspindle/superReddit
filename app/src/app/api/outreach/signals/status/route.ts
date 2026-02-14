import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signal_id, status } = body;

    if (!signal_id || !status) {
      return NextResponse.json({ error: 'signal_id and status are required' }, { status: 400 });
    }

    const validStatuses = ['new', 'replied', 'dismissed', 'converted'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('outreach_signals')
      .update({ status })
      .eq('id', signal_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Signal status update error:', error);
    return NextResponse.json({ error: 'Failed to update signal status' }, { status: 500 });
  }
}

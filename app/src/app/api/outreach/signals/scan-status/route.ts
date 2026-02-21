import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getScanStatus } from '@/lib/outreach/poll-queue';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const status = await getScanStatus(supabase, projectId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Scan status error:', error);
    return NextResponse.json({ status: 'idle' });
  }
}

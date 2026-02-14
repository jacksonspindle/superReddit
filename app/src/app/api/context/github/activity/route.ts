import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('github_connections')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ connection: data });
  } catch (error) {
    console.error('GitHub activity GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch GitHub connection' }, { status: 500 });
  }
}

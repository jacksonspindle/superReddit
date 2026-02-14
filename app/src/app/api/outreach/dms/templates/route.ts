import { NextResponse } from 'next/server';
import { DM_TEMPLATES } from '@/lib/outreach/dm-templates';

export async function GET() {
  return NextResponse.json({ templates: DM_TEMPLATES });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';
import { DM_DRAFT_SYSTEM_PROMPT, buildDmDraftPrompt } from '@/lib/ai/prompts';
import { getTemplate } from '@/lib/outreach/dm-templates';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dm_id, project_id, template_id } = body;

    if (!dm_id || !project_id) {
      return NextResponse.json(
        { error: 'dm_id and project_id are required' },
        { status: 400 }
      );
    }

    // Verify auth
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServiceClient();

    // Get DM record
    const { data: dm } = await supabase
      .from('outreach_dms')
      .select('*, signal:outreach_signals(title, subreddit, permalink)')
      .eq('id', dm_id)
      .single();

    if (!dm) {
      return NextResponse.json({ error: 'DM record not found' }, { status: 404 });
    }

    // Get project for product context
    const { data: project } = await supabase
      .from('projects')
      .select('product_name, product_description, product_url')
      .eq('id', project_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get template hint if provided
    const template = template_id ? getTemplate(template_id) : null;

    const client = getAnthropicClient();
    const prompt = buildDmDraftPrompt(
      {
        username: dm.reddit_username,
        commentText: dm.comment_text || '',
        threadPermalink: dm.source_thread_permalink,
      },
      {
        name: project.product_name,
        description: project.product_description,
        url: project.product_url || undefined,
      },
      {
        templateHint: template ? { subject_hint: template.subject_hint, body_hint: template.body_hint } : null,
        touchNumber: dm.touch_number || 0,
        threadTitle: dm.signal?.title,
        subreddit: dm.signal?.subreddit,
      }
    );

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: DM_DRAFT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(responseText) as { subject: string; body: string };

    // Update DM record with draft
    const { error: updateError } = await supabase
      .from('outreach_dms')
      .update({
        dm_subject: parsed.subject,
        dm_body: parsed.body,
        dm_template_id: template_id || null,
        pipeline_stage: 'draft_generated',
      })
      .eq('id', dm_id);

    if (updateError) {
      return NextResponse.json({
        subject: parsed.subject,
        body: parsed.body,
        saved: false,
      });
    }

    return NextResponse.json({
      subject: parsed.subject,
      body: parsed.body,
      saved: true,
    });
  } catch (error) {
    console.error('DM draft error:', error);
    return NextResponse.json({ error: 'Failed to generate DM draft' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';
import { REPLY_DRAFT_SYSTEM_PROMPT, buildReplyDraftPrompt } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signal_id, project_id, reply_mode } = body;

    if (!signal_id || !project_id) {
      return NextResponse.json(
        { error: 'signal_id and project_id are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get signal
    const { data: signal } = await supabase
      .from('outreach_signals')
      .select('*')
      .eq('id', signal_id)
      .single();

    if (!signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
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

    // Get subreddit compliance notes if available
    const { data: rules } = await supabase
      .from('subreddit_rules')
      .select('compliance_profile, safety_score')
      .eq('subreddit', signal.subreddit)
      .maybeSingle();

    let complianceNotes: string | null = null;
    if (rules?.compliance_profile) {
      const profile = rules.compliance_profile as Record<string, unknown>;
      const notes: string[] = [];
      if (!profile.selfPromoAllowed) notes.push('Self-promotion is NOT allowed');
      if (!profile.linkPostsAllowed) notes.push('Link posts are restricted');
      if (profile.flairRequired) notes.push('Flair is required');
      if (profile.restrictedKeywords) {
        const kws = profile.restrictedKeywords as string[];
        if (kws.length > 0) notes.push(`Restricted keywords: ${kws.join(', ')}`);
      }
      if (notes.length > 0) complianceNotes = notes.join('\n');
    }

    const client = getAnthropicClient();
    const mode = reply_mode || 'helpful';
    const prompt = buildReplyDraftPrompt(
      {
        title: signal.title,
        body: signal.body,
        subreddit: signal.subreddit,
        author: signal.author,
      },
      {
        name: project.product_name,
        description: project.product_description,
        url: project.product_url || undefined,
      },
      complianceNotes,
      mode
    );

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: REPLY_DRAFT_SYSTEM_PROMPT,
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

    const parsed = JSON.parse(responseText) as { reply: string };

    // Save reply draft
    const { data: reply, error: replyError } = await supabase
      .from('outreach_replies')
      .insert({
        project_id,
        signal_id,
        thread_permalink: signal.permalink,
        draft_text: parsed.reply,
        reply_mode: mode,
        status: 'draft',
      })
      .select()
      .single();

    if (replyError) {
      // Still return the draft even if save failed
      return NextResponse.json({ reply: parsed.reply, saved: false });
    }

    return NextResponse.json({ reply: parsed.reply, reply_id: reply.id, saved: true });
  } catch (error) {
    console.error('Outreach reply error:', error);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}

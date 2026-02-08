import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client';
import { REWRITE_SYSTEM_PROMPT, buildRewritePrompt } from '@/lib/ai/prompts';
import type { RewriteRequest, RewriteResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RewriteRequest = await request.json();

    if (!body.text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!body.tone) {
      return NextResponse.json({ error: 'Tone is required' }, { status: 400 });
    }

    const client = getAnthropicClient();
    const prompt = buildRewritePrompt(body.text, body.tone, body.context);

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: REWRITE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const response: RewriteResponse = { text: textContent.text.trim() };
    return NextResponse.json(response);
  } catch (error) {
    console.error('AI rewrite error:', error);
    return NextResponse.json(
      { error: 'Failed to rewrite text. Please try again.' },
      { status: 500 }
    );
  }
}

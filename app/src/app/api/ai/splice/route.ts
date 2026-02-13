import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client';
import { SPLICE_SYSTEM_PROMPT, buildSplicePrompt } from '@/lib/ai/prompts';
import type { SpliceRequest, SpliceResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: SpliceRequest = await request.json();

    if (!body.selectedPosts?.length || body.selectedPosts.length > 2) {
      return NextResponse.json(
        { error: 'Between 1 and 2 posts are required' },
        { status: 400 }
      );
    }

    if (!body.productContext?.name || !body.productContext?.description) {
      return NextResponse.json(
        { error: 'Product name and description are required' },
        { status: 400 }
      );
    }

    if (!body.controls?.targetSubreddit) {
      return NextResponse.json(
        { error: 'Target subreddit is required' },
        { status: 400 }
      );
    }

    const client = getAnthropicClient();
    const prompt = buildSplicePrompt(
      body.productContext,
      body.selectedPosts,
      body.controls
    );

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: SPLICE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed: SpliceResponse = JSON.parse(responseText);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AI splice error:', error);
    return NextResponse.json(
      { error: 'Failed to generate spliced post. Please try again.' },
      { status: 500 }
    );
  }
}

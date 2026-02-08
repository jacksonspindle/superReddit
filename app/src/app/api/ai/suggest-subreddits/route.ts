import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client';
import { SUGGEST_SUBREDDITS_SYSTEM_PROMPT, buildSuggestSubredditsPrompt } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.description) {
      return NextResponse.json(
        { error: 'Product name and description are required' },
        { status: 400 }
      );
    }

    const client = getAnthropicClient();
    const prompt = buildSuggestSubredditsPrompt({
      name: body.name,
      description: body.description,
      url: body.url,
      audience: body.audience,
      tone: body.tone || 'Professional',
    });

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: SUGGEST_SUBREDDITS_SYSTEM_PROMPT,
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

    const parsed = JSON.parse(responseText);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('AI suggest-subreddits error:', error);
    return NextResponse.json(
      { error: 'Failed to suggest subreddits. Please try again.' },
      { status: 500 }
    );
  }
}

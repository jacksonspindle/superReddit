import { NextRequest, NextResponse } from 'next/server';
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client';
import { ANALYZE_SUBREDDIT_SYSTEM_PROMPT, buildAnalyzeSubredditPrompt } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.subredditName || !body.posts || body.posts.length === 0) {
      return NextResponse.json(
        { error: 'Subreddit name and posts are required' },
        { status: 400 }
      );
    }

    const client = getAnthropicClient();
    const prompt = buildAnalyzeSubredditPrompt(
      body.subredditName,
      body.posts,
      body.product || undefined
    );

    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      system: ANALYZE_SUBREDDIT_SYSTEM_PROMPT,
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
    console.error('AI analyze-subreddit error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze subreddit. Please try again.' },
      { status: 500 }
    );
  }
}
